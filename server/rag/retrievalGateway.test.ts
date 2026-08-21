import { describe, expect, it, vi } from "vitest";
import { getGatewayIndexStatus, retrieveFromGateway } from "./retrievalGateway";

const gatewayResponse = {
  indexVersion: "msmarco-xi-hi-v1",
  matches: [{
    id: "233826-fixed_overlap-0",
    documentId: "233826",
    language: "hi",
    strategy: "fixed_overlap",
    content: "Eagles fly 30 to 55 mph and dive at over 100 mph.",
    denseScore: 0.83,
    sparseScore: 7.12,
    rrfScore: 0.031,
    source: { dataset: "ai4bharat/MSMARCO-XI", split: "validation", queryId: 233826, passageOrdinal: 0 },
  }],
  timings: { queryEmbeddingMs: 18.4, denseSearchMs: 21.6, sparseSearchMs: 14.2, fusionMs: 1.1, totalMs: 58.7 },
};

describe("retrieval gateway contract", () => {
  it("sends a server-side authenticated request and returns validated source matches", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response(JSON.stringify(gatewayResponse), { status: 200 }));

    const result = await retrieveFromGateway(
      { query: "How fast does an eagle travel?" },
      { url: "https://retrieval.example.test/v1/retrieve", token: "server-only-token", timeoutMs: 120 },
      fetchImpl,
    );

    expect(result.indexVersion).toBe("msmarco-xi-hi-v1");
    expect(result.matches[0]?.source.dataset).toBe("ai4bharat/MSMARCO-XI");
    expect(fetchImpl).toHaveBeenCalledWith(
      "https://retrieval.example.test/v1/retrieve",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ authorization: "Bearer server-only-token" }),
      }),
    );
  });

  it("rejects malformed gateway results instead of presenting ungrounded sources", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response(JSON.stringify({ matches: [] }), { status: 200 }));

    await expect(retrieveFromGateway(
      { query: "How fast does an eagle travel?" },
      { url: "https://retrieval.example.test/v1/retrieve", token: "server-only-token" },
      fetchImpl,
    )).rejects.toThrow("not a valid retrieval payload");
  });

  it("reads validated index status using the paired server-only status endpoint", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response(JSON.stringify({ indexVersion: "msmarco_xi_hi_1k_v1", pointsCount: 1034, vectorsCount: 0, status: "green" }), { status: 200 }));
    const result = await getGatewayIndexStatus(
      { url: "https://retrieval.example.test/v1/retrieve", token: "server-only-token" },
      fetchImpl,
    );

    expect(result).toEqual({ indexVersion: "msmarco_xi_hi_1k_v1", pointsCount: 1034, vectorsCount: 0, status: "green" });
    expect(fetchImpl).toHaveBeenCalledWith(
      "https://retrieval.example.test/v1/index-status",
      expect.objectContaining({ headers: { authorization: "Bearer server-only-token" } }),
    );
  });
});
