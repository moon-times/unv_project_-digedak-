// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createEmptySong } from "@/types/song";

const supabase = vi.hoisted(() => ({
  claims: { sub: "u1" } as object | null,
  rpc: vi.fn(),
}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getClaims: async () => ({ data: { claims: supabase.claims } }) },
    rpc: supabase.rpc,
  }),
}));
const load = vi.hoisted(() => vi.fn());
vi.mock("@/lib/supabase/projects", () => ({ loadProject: load }));
const plan = vi.hoisted(() => vi.fn());
vi.mock("@/lib/llm/planArrangement", () => ({ planArrangement: plan }));

const { GET, POST, RETOUCH_LIMIT } = await import("./route");

const ID = "7d6b2c1e-3f4a-4b5c-8d9e-0a1b2c3d4e5f";
const song = createEmptySong();
const draft = { sections: [], endingHit: true, summary: "크게 키웠어요." };

/** rpc 응답: retouch_used는 used, consume_retouch는 consumed */
function rpcReturns(used: number | null, consumed = true) {
  supabase.rpc.mockImplementation(async (name: string) =>
    name === "retouch_used"
      ? { data: used, error: null }
      : { data: consumed, error: null },
  );
}
const post = async (body: unknown) => {
  const response = await POST(
    new Request("https://app.example/api/retouch", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  );
  return { status: response.status, json: await response.json() };
};
const consumeCalls = () =>
  supabase.rpc.mock.calls.filter(([name]) => name === "consume_retouch");

beforeEach(() => {
  supabase.claims = { sub: "u1" };
  rpcReturns(0);
  load.mockReset().mockResolvedValue({ status: "ok", song });
  plan.mockReset().mockResolvedValue(draft);
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("POST /api/retouch", () => {
  it("id 형식이 틀리면 400, 게스트면 401", async () => {
    expect((await post({ projectId: "x" })).status).toBe(400);
    supabase.claims = null;
    expect((await post({ projectId: ID })).status).toBe(401);
    expect(plan).not.toHaveBeenCalled();
  });

  it("내 프로젝트가 아니면 403", async () => {
    rpcReturns(null);
    expect((await post({ projectId: ID })).status).toBe(403);
    expect(plan).not.toHaveBeenCalled();
  });

  it("다 썼으면 LLM을 부르지 않고 limited", async () => {
    rpcReturns(RETOUCH_LIMIT);
    expect((await post({ projectId: ID })).json).toEqual({
      limited: true,
      remaining: 0,
    });
    expect(plan).not.toHaveBeenCalled();
  });

  it("저장된 곡으로 계획하고, 성공하면 하나 차감", async () => {
    rpcReturns(1);
    const { json } = await post({ projectId: ID });
    expect(load).toHaveBeenCalledWith(expect.anything(), ID);
    expect(plan).toHaveBeenCalledWith(song);
    expect(consumeCalls()).toEqual([
      ["consume_retouch", { target: ID, max_count: RETOUCH_LIMIT }],
    ]);
    expect(json).toEqual({ plan: draft, remaining: RETOUCH_LIMIT - 2 });
  });

  it("계획을 못 만들면 차감하지 않음", async () => {
    plan.mockResolvedValue(null);
    expect((await post({ projectId: ID })).json).toEqual({
      error: "failed",
      remaining: RETOUCH_LIMIT,
    });
    expect(consumeCalls()).toEqual([]);
  });

  it("그새 다른 요청이 마지막 횟수를 썼으면 계획을 버림", async () => {
    rpcReturns(RETOUCH_LIMIT - 1, false);
    expect((await post({ projectId: ID })).json).toEqual({
      limited: true,
      remaining: 0,
    });
  });
});

describe("GET /api/retouch", () => {
  it("남은 횟수", async () => {
    rpcReturns(2);
    const response = await GET(
      new Request(`https://app.example/api/retouch?projectId=${ID}`),
    );
    expect(await response.json()).toEqual({ remaining: RETOUCH_LIMIT - 2 });
  });
});
