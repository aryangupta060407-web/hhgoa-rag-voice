#!/usr/bin/env node
/**
 * Offline full-corpus index builder for ai4bharat/MSMARCO-XI JSONL exports.
 *
 * This script is intentionally not part of the deployed web app. Run it on a
 * machine that hosts or can reach Qdrant and a multilingual embedding endpoint.
 * The endpoint contract is POST { texts: string[] } -> { vectors: number[][] }.
 *
 * Example:
 * QDRANT_URL=https://qdrant.example.com QDRANT_API_KEY=... \
 * EMBEDDING_URL=https://embedding.example.com/v1/embed EMBEDDING_TOKEN=... \
 * pnpm index:qdrant -- --source /data/hinval.jsonl --collection msmarco_xi_hi_v1 --split validation --max-records 100000
 */
import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { createInterface } from "node:readline";

const args = new Map();
for (let index = 2; index < process.argv.length; index += 1) {
  const key = process.argv[index];
  if (!key.startsWith("--")) continue;
  const value = process.argv[index + 1] && !process.argv[index + 1].startsWith("--") ? process.argv[++index] : "true";
  args.set(key, value);
}

const required = (name, value) => {
  if (!value) throw new Error(`${name} is required`);
  return value;
};
const qdrantUrl = required("QDRANT_URL", process.env.QDRANT_URL).replace(/\/$/, "");
const source = required("--source", args.get("--source"));
const collection = args.get("--collection") ?? "msmarco_xi_hi_v1";
const split = args.get("--split") ?? "validation";
const embeddingUrl = required("EMBEDDING_URL", process.env.EMBEDDING_URL).replace(/\/$/, "");
const embeddingToken = process.env.EMBEDDING_TOKEN ?? "";
const qdrantToken = process.env.QDRANT_API_KEY ?? "";
const vectorSize = Number(args.get("--vector-size") ?? "384");
const batchSize = Number(args.get("--batch-size") ?? "64");
const maxRecords = Number(args.get("--max-records") ?? "0");
const dryRun = args.get("--dry-run") === "true";

if (!Number.isInteger(vectorSize) || vectorSize < 8) throw new Error("--vector-size must be a positive integer");
if (!Number.isInteger(batchSize) || batchSize < 1 || batchSize > 256) throw new Error("--batch-size must be between 1 and 256");

const qdrantHeaders = {
  "content-type": "application/json",
  ...(qdrantToken ? { "api-key": qdrantToken } : {}),
};
const embeddingHeaders = {
  "content-type": "application/json",
  ...(embeddingToken ? { authorization: `Bearer ${embeddingToken}` } : {}),
};

const normalize = value => String(value ?? "").normalize("NFKC").replace(/\s+/g, " ").trim();
const contentHash = value => createHash("sha256").update(value).digest("hex");
const asUuid = hash => `${hash.slice(0, 8)}-${hash.slice(8, 12)}-${hash.slice(12, 16)}-${hash.slice(16, 20)}-${hash.slice(20, 32)}`;
const tokenize = text => normalize(text).toLocaleLowerCase().match(/[A-Za-z0-9\u0900-\u097F]+/g)?.filter(token => token.length > 1) ?? [];

function sparseVector(text) {
  const weights = new Map();
  for (const token of tokenize(text)) {
    const hash = createHash("sha1").update(token).digest();
    const index = hash.readUInt32BE(0) % 1_000_000;
    weights.set(index, (weights.get(index) ?? 0) + 1);
  }
  const ordered = [...weights.entries()].sort(([left], [right]) => left - right);
  return { indices: ordered.map(([index]) => index), values: ordered.map(([, value]) => value) };
}

function passagesFor(record) {
  const passages = record.passages ?? {};
  const translated = Array.isArray(passages.Translated_passages) ? passages.Translated_passages : [];
  const english = Array.isArray(passages.English_passages) ? passages.English_passages : [];
  const selected = Array.isArray(passages.is_selected) ? passages.is_selected : [];
  const candidates = translated.map((value, index) => ({
    translated: normalize(value),
    english: normalize(english[index]),
    selected: Number(selected[index] ?? 0) === 1,
    ordinal: index,
  })).filter(item => item.translated || item.english);
  const preferred = candidates.filter(item => item.selected);
  return preferred.length ? preferred : candidates.slice(0, 1);
}

function sourceChunks(record) {
  const query = normalize(record.query ?? record.Translated_Query);
  const englishQuery = normalize(record.Eng_Query ?? record.englishQuery);
  const queryId = Number(record.query_id ?? record.queryId ?? 0);
  const language = normalize(record.target_lang ?? record.language ?? "hi");
  return passagesFor(record).map(passage => {
    const content = normalize([passage.translated, passage.english].filter(Boolean).join("\n"));
    const hash = contentHash(`${language}\n${content}`);
    return {
      id: asUuid(hash),
      content,
      queryId,
      language,
      passageOrdinal: passage.ordinal,
      payload: {
        dataset: "ai4bharat/MSMARCO-XI",
        split,
        language,
        queryId,
        passageOrdinal: passage.ordinal,
        sourceQuery: query,
        sourceEnglishQuery: englishQuery,
        contentHash: hash,
        strategy: "selected_passage",
      },
    };
  });
}

async function qdrant(path, options = {}) {
  const response = await fetch(`${qdrantUrl}${path}`, { headers: qdrantHeaders, ...options });
  if (!response.ok) throw new Error(`Qdrant ${options.method ?? "GET"} ${path} returned ${response.status}: ${await response.text()}`);
  return response.json();
}

async function ensureCollection() {
  const existing = await fetch(`${qdrantUrl}/collections/${collection}`, { headers: qdrantHeaders });
  if (existing.ok) return;
  if (existing.status !== 404) throw new Error(`Could not inspect Qdrant collection: ${existing.status}`);
  await qdrant(`/collections/${collection}`, {
    method: "PUT",
    body: JSON.stringify({
      vectors: { dense: { size: vectorSize, distance: "Cosine" } },
      sparse_vectors: { bm25: {} },
      on_disk_payload: true,
    }),
  });
  for (const field of ["language", "dataset", "split", "strategy"]) {
    await qdrant(`/collections/${collection}/index`, { method: "PUT", body: JSON.stringify({ field_name: field, field_schema: "keyword" }) });
  }
}

async function embed(texts) {
  const response = await fetch(embeddingUrl, { method: "POST", headers: embeddingHeaders, body: JSON.stringify({ texts }) });
  if (!response.ok) throw new Error(`Embedding service returned ${response.status}: ${await response.text()}`);
  const body = await response.json();
  if (!Array.isArray(body.vectors) || body.vectors.length !== texts.length) throw new Error("Embedding service must return one vector per input text");
  return body.vectors.map((vector, index) => {
    if (!Array.isArray(vector) || vector.length !== vectorSize || vector.some(value => typeof value !== "number" || !Number.isFinite(value))) {
      throw new Error(`Embedding ${index} is not a valid ${vectorSize}-dimension numeric vector`);
    }
    return vector;
  });
}

async function flush(chunks) {
  if (!chunks.length) return;
  const vectors = await embed(chunks.map(chunk => chunk.content));
  if (!dryRun) {
    await qdrant(`/collections/${collection}/points?wait=true`, {
      method: "PUT",
      body: JSON.stringify({
        points: chunks.map((chunk, index) => ({
          id: chunk.id,
          vector: { dense: vectors[index], bm25: sparseVector(chunk.content) },
          payload: { ...chunk.payload, content: chunk.content },
        })),
      }),
    });
  }
}

if (!dryRun) await ensureCollection();
const reader = createInterface({ input: createReadStream(source, { encoding: "utf8" }), crlfDelay: Infinity });
let records = 0;
let chunks = 0;
let malformed = 0;
let pending = [];
for await (const line of reader) {
  if (!line.trim()) continue;
  let record;
  try { record = JSON.parse(line); } catch { malformed += 1; continue; }
  records += 1;
  pending.push(...sourceChunks(record));
  while (pending.length >= batchSize) {
    const batch = pending.splice(0, batchSize);
    await flush(batch);
    chunks += batch.length;
  }
  if (records % 5_000 === 0) console.log(JSON.stringify({ records, chunks, malformed, collection, dryRun }));
  if (maxRecords && records >= maxRecords) break;
}
if (pending.length) {
  await flush(pending);
  chunks += pending.length;
}
console.log(JSON.stringify({ complete: true, records, chunks, malformed, collection, split, dryRun }));

