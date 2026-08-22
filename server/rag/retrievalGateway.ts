import { ENV } from "../_core/env";

export type RetrievalGatewayRequest = {
  query: string;
  language?: string;
  limit?: number;
  minGroundingScore?: number;
  indexVersion?: string;
};

export type RetrievalGatewayMatch = {
  id: string;
  documentId: string;
  language: string;
  strategy: string;
  content: string;
  denseScore: number;
  sparseScore: number;
  rrfScore: number;
  source: {
    dataset: string;
    split: string;
    queryId?: number;
    passageOrdinal?: number;
  };
};

export type RetrievalGatewayResponse = {
  indexVersion: string;
  matches: RetrievalGatewayMatch[];
  timings: {
    queryEmbeddingMs: number;
    denseSearchMs: number;
    sparseSearchMs: number;
    fusionMs: number;
    totalMs: number;
  };
};

export type RetrievalGatewayConfig = {
  url: string;
  token: string;
  timeoutMs?: number;
};

export type RetrievalGatewayIndexStatus = {
  indexVersion: string;
  pointsCount: number;
  vectorsCount: number;
  status: string;
  languageCounts?: Partial<Record<"hi" | "en" | "mr", number>>;
  supportedLanguages?: string[];
};

const DEFAULT_TIMEOUT_MS = 120;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function asNumber(value: unknown, field: string) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`Retrieval gateway response has invalid ${field}`);
  }
  return value;
}

function asText(value: unknown, field: string) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`Retrieval gateway response has invalid ${field}`);
  }
  return value;
}

function parseResponse(value: unknown): RetrievalGatewayResponse {
  if (!isRecord(value) || !Array.isArray(value.matches) || !isRecord(value.timings)) {
    throw new Error("Retrieval gateway response is not a valid retrieval payload");
  }

  const matches = value.matches.map((match, index) => {
    if (!isRecord(match) || !isRecord(match.source)) {
      throw new Error(`Retrieval gateway response has invalid match ${index}`);
    }
    return {
      id: asText(match.id, `matches[${index}].id`),
      documentId: asText(match.documentId, `matches[${index}].documentId`),
      language: asText(match.language, `matches[${index}].language`),
      strategy: asText(match.strategy, `matches[${index}].strategy`),
      content: asText(match.content, `matches[${index}].content`),
      denseScore: asNumber(match.denseScore, `matches[${index}].denseScore`),
      sparseScore: asNumber(match.sparseScore, `matches[${index}].sparseScore`),
      rrfScore: asNumber(match.rrfScore, `matches[${index}].rrfScore`),
      source: {
        dataset: asText(match.source.dataset, `matches[${index}].source.dataset`),
        split: asText(match.source.split, `matches[${index}].source.split`),
        ...(typeof match.source.queryId === "number" ? { queryId: match.source.queryId } : {}),
        ...(typeof match.source.passageOrdinal === "number" ? { passageOrdinal: match.source.passageOrdinal } : {}),
      },
    } satisfies RetrievalGatewayMatch;
  });

  return {
    indexVersion: asText(value.indexVersion, "indexVersion"),
    matches,
    timings: {
      queryEmbeddingMs: asNumber(value.timings.queryEmbeddingMs, "timings.queryEmbeddingMs"),
      denseSearchMs: asNumber(value.timings.denseSearchMs, "timings.denseSearchMs"),
      sparseSearchMs: asNumber(value.timings.sparseSearchMs, "timings.sparseSearchMs"),
      fusionMs: asNumber(value.timings.fusionMs, "timings.fusionMs"),
      totalMs: asNumber(value.timings.totalMs, "timings.totalMs"),
    },
  };
}

export function getRetrievalGatewayConfig(): RetrievalGatewayConfig | null {
  if (!ENV.corpusRetrievalUrl || !ENV.corpusRetrievalToken) return null;
  return {
    url: ENV.corpusRetrievalUrl,
    token: ENV.corpusRetrievalToken,
    timeoutMs: DEFAULT_TIMEOUT_MS,
  };
}

export async function retrieveFromGateway(
  request: RetrievalGatewayRequest,
  config: RetrievalGatewayConfig,
  fetchImpl: typeof fetch = fetch,
): Promise<RetrievalGatewayResponse> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.timeoutMs ?? DEFAULT_TIMEOUT_MS);

  try {
    const response = await fetchImpl(config.url, {
      method: "POST",
      headers: {
        authorization: `Bearer ${config.token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        query: request.query,
        language: request.language ?? "auto",
        limit: request.limit ?? 3,
        minGroundingScore: request.minGroundingScore ?? 0.16,
        indexVersion: request.indexVersion,
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`Retrieval gateway returned ${response.status}`);
    }
    return parseResponse(await response.json());
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error(`Retrieval gateway exceeded ${config.timeoutMs ?? DEFAULT_TIMEOUT_MS} ms`);
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

export async function getGatewayIndexStatus(
  config: RetrievalGatewayConfig,
  fetchImpl: typeof fetch = fetch,
): Promise<RetrievalGatewayIndexStatus> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.timeoutMs ?? DEFAULT_TIMEOUT_MS);
  const statusUrl = config.url.replace(/\/v1\/retrieve\/?$/, "/v1/index-status");

  try {
    const response = await fetchImpl(statusUrl, {
      headers: { authorization: `Bearer ${config.token}` },
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`Retrieval gateway status returned ${response.status}`);
    const body: unknown = await response.json();
    if (!isRecord(body)) throw new Error("Retrieval gateway index status is malformed");
    const languageCounts = isRecord(body.languageCounts)
      ? Object.fromEntries(Object.entries(body.languageCounts).filter((entry): entry is [string, number] => typeof entry[1] === "number" && Number.isFinite(entry[1]))) as Partial<Record<"hi" | "en" | "mr", number>>
      : undefined;
    return {
      indexVersion: asText(body.indexVersion, "indexVersion"),
      pointsCount: asNumber(body.pointsCount, "pointsCount"),
      vectorsCount: asNumber(body.vectorsCount, "vectorsCount"),
      status: asText(body.status, "status"),
      ...(languageCounts ? { languageCounts } : {}),
      ...(Array.isArray(body.supportedLanguages) ? { supportedLanguages: body.supportedLanguages.filter((value): value is string => typeof value === "string") } : {}),
    };
  } finally {
    clearTimeout(timeout);
  }
}
