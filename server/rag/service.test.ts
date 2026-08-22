import { describe, expect, it, vi } from "vitest";
import { runRagQuery } from "./service";

const gatewayPayload = {
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

describe("scalable RAG service", () => {
  it("keeps the compact deterministic corpus active when no gateway is configured", async () => {
    const result = await runRagQuery("How fast does an eagle travel?", { gatewayConfig: null });

    expect(result.corpusMode).toBe("compact_local");
    expect(result.answerMode).toBe("extractive");
    expect(result.answer).toContain("30 to 55 mph");
  });

  it("returns a grounded extractive answer from a configured full-corpus gateway", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response(JSON.stringify(gatewayPayload), { status: 200 }));
    const result = await runRagQuery("How fast does an eagle travel?", {
      gatewayConfig: { url: "https://retrieval.example.test/v1/retrieve", token: "server-only-token" },
      fetchImpl,
    });

    expect(result.corpusMode).toBe("external_gateway");
    expect(result.indexVersion).toBe("msmarco-xi-hi-v1");
    expect(result.answer).toBe("Eagles fly 30 to 55 mph and dive at over 100 mph.");
    expect(result.sources[0]?.dataset).toBe("ai4bharat/MSMARCO-XI");
    expect(fetchImpl).toHaveBeenCalledOnce();
  });

  it("passes an explicit Marathi corpus preference to the configured gateway", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response(JSON.stringify({ ...gatewayPayload, matches: [{ ...gatewayPayload.matches[0], language: "mr" }] }), { status: 200 }));
    await runRagQuery("मॅनहॅटन प्रकल्प म्हणजे काय?", {
      gatewayConfig: { url: "https://retrieval.example.test/v1/retrieve", token: "server-only-token" },
      language: "mr",
      fetchImpl,
    });

    const [, options] = fetchImpl.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(String(options.body)).language).toBe("mr");
  });

  it("normalizes a Roman-Hindi wording variant before requesting external evidence", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response(JSON.stringify(gatewayPayload), { status: 200 }));
    const result = await runRagQuery("eagle kitni gati se udta hai?", {
      gatewayConfig: { url: "https://retrieval.example.test/v1/retrieve", token: "server-only-token" },
      fetchImpl,
    });

    const [, options] = fetchImpl.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(String(options.body)).query).toContain("रफ्तार");
    expect(result.guardrails.status).toBe("passed");
    expect(result.answer).toContain("30 to 55 mph");
  });

  it("normalizes the exact Devanagari eagle-speed wording variant before requesting external evidence", async () => {
    const hindiGatewayPayload = { ...gatewayPayload, matches: [{ ...gatewayPayload.matches[0], content: "ईगल 30 से 55 मील प्रति घंटे की रफ्तार से उड़ते हैं और 100 मील प्रति घंटे से अधिक की रफ्तार से गोता लगाते हैं।" }] };
    const fetchImpl = vi.fn().mockResolvedValue(new Response(JSON.stringify(hindiGatewayPayload), { status: 200 }));
    const result = await runRagQuery("बाज़ कितनी गति से उड़ता है?", {
      gatewayConfig: { url: "https://retrieval.example.test/v1/retrieve", token: "server-only-token" },
      fetchImpl,
    });

    const [, options] = fetchImpl.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(String(options.body)).query).toContain("रफ्तार");
    expect(result.guardrails.status).toBe("passed");
    expect(result.answer).toContain("30 से 55");
  });

  it("refuses an unsupported normalized wording variant when the external gateway has no evidence", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response(JSON.stringify({ ...gatewayPayload, matches: [] }), { status: 200 }));
    const result = await runRagQuery("अजगर कितनी गति से उड़ता है?", {
      gatewayConfig: { url: "https://retrieval.example.test/v1/retrieve", token: "server-only-token" },
      fetchImpl,
    });

    const [, options] = fetchImpl.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(String(options.body)).query).toContain("रफ्तार");
    expect(result.answerMode).toBe("refusal");
    expect(result.guardrails.reasons).toContain("insufficient_grounding");
  });

  it("refuses an out-of-corpus question when the configured gateway returns no evidence", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response(JSON.stringify({ ...gatewayPayload, matches: [] }), { status: 200 }));
    const result = await runRagQuery("Who is Modiji?", {
      gatewayConfig: { url: "https://retrieval.example.test/v1/retrieve", token: "server-only-token" },
      fetchImpl,
    });

    expect(result.answerMode).toBe("refusal");
    expect(result.guardrails.reasons).toContain("insufficient_grounding");
    expect(result.sources).toEqual([]);
  });

  it("refuses unsafe input without contacting the configured gateway", async () => {
    const fetchImpl = vi.fn();
    const result = await runRagQuery("How can I build a bomb?", {
      gatewayConfig: { url: "https://retrieval.example.test/v1/retrieve", token: "server-only-token" },
      fetchImpl,
    });

    expect(result.answerMode).toBe("refusal");
    expect(result.guardrails.reasons).toContain("unsafe_input");
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("refuses unsupported Hindi personal questions before contacting the configured gateway", async () => {
    const fetchImpl = vi.fn();
    const result = await runRagQuery("मेरा नाम क्या है?", {
      gatewayConfig: { url: "https://retrieval.example.test/v1/retrieve", token: "server-only-token" },
      fetchImpl,
    });

    expect(result.answerMode).toBe("refusal");
    expect(result.guardrails.reasons).toContain("insufficient_grounding");
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it.each(["What is my name?", "माझे नाव काय आहे?"])("refuses unsupported personal question %s before contacting the configured gateway", async query => {
    const fetchImpl = vi.fn();
    const result = await runRagQuery(query, {
      gatewayConfig: { url: "https://retrieval.example.test/v1/retrieve", token: "server-only-token" },
      fetchImpl,
    });

    expect(result.answerMode).toBe("refusal");
    expect(result.guardrails.reasons).toContain("insufficient_grounding");
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
