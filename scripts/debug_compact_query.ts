import { clearSemanticCache, INDEXED_CHUNKS, runDeterministicRag, tokenize } from "../server/rag/pipeline";

const query = process.argv.slice(2).join(" ") || "How do I make biryani?";
clearSemanticCache();
const outcome = runDeterministicRag(query);
const queryTokens = tokenize(query);
const top = outcome.sources[0] ? INDEXED_CHUNKS.find(chunk => chunk.id === outcome.sources[0]?.id) : undefined;
console.log(JSON.stringify({
  queryTokens,
  topMatchedTokens: top ? queryTokens.filter(token => top.tokenSet.has(token)) : [],
  outcome,
}, null, 2));
