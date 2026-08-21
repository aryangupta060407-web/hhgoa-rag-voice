import { describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";

const persistence = vi.hoisted(() => ({
  insertRagQuery: vi.fn(),
  getRecentRagQueries: vi.fn().mockResolvedValue([]),
}));

vi.mock("./db", () => ({
  insertRagQuery: persistence.insertRagQuery,
  getRecentRagQueries: persistence.getRecentRagQueries,
}));

import { appRouter } from "./routers";

function createPublicContext(): TrpcContext {
  return {
    user: null,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

describe("rag.query persistence", () => {
  it("returns the grounded response before a slow history write resolves", async () => {
    let finishPersistence: (() => void) | undefined;
    persistence.insertRagQuery.mockImplementationOnce(() => new Promise<void>(resolve => {
      finishPersistence = resolve;
    }));

    const caller = appRouter.createCaller(createPublicContext());
    const result = await caller.rag.query({ query: "How fast does an eagle travel?" });

    expect(result.answerMode).toBe("extractive");
    expect(result.answer).toContain("30 to 55 mph");
    expect(persistence.insertRagQuery).toHaveBeenCalledOnce();

    finishPersistence?.();
  });
});
