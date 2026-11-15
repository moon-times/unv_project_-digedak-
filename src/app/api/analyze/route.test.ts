// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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
const polish = vi.hoisted(() => vi.fn());
vi.mock("@/lib/llm/polishExplanation", () => ({ polishExplanation: polish }));
const recommend = vi.hoisted(() => vi.fn());
vi.mock("@/lib/llm/recommendChords", () => ({ recommendChords: recommend }));

const { POST, DAILY_POLISH_LIMIT, DAILY_RECOMMEND_LIMIT } =
  await import("./route");

const analysis = {
  key: "C major",
  chords: [
    { symbol: "C", start: 0, duration: 16 },
    { symbol: "G", start: 16, duration: 16 },
  ],
  recommendedStyle: "pop",
  bpmSuggestion: 100,
  explanation: "멜로디에 C, E, G 음이 많이 쓰여 C장조로 판단했습니다.",
};
const body = { analysis };
const call = async (payload: unknown) => {
  const response = await POST(
    new Request("https://app.example/api/analyze", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  );
  return { status: response.status, json: await response.json() };
};

beforeEach(() => {
  supabase.claims = { sub: "u1" };
  vi.stubEnv("ANTHROPIC_API_KEY", "test-key");
  supabase.rpc.mockReset().mockResolvedValue({ data: true, error: null });
  polish.mockReset();
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  vi.unstubAllEnvs();
});

describe("POST /api/analyze", () => {
  it("형식이 틀리면 400, LLM 안 부름", async () => {
    expect((await call({ analysis: "x" })).status).toBe(400);
    // LLM에 그대로 가는 글자는 길이를 막습니다.
    const longChord = { symbol: "C".repeat(13), start: 0, duration: 16 };
    for (const big of [
      { ...analysis, key: "가".repeat(21) },
      { ...analysis, chords: [longChord] },
    ])
      expect((await call({ analysis: big })).status).toBe(400);
    expect(
      (
        await call({
          ...body,
          analysis: { ...analysis, explanation: "가".repeat(1001) },
        })
      ).status,
    ).toBe(400);
    expect(polish).not.toHaveBeenCalled();
  });

  it("로그인 안 했으면 401, 한도도 안 깎음", async () => {
    supabase.claims = null;
    expect((await call(body)).status).toBe(401);
    expect(supabase.rpc).not.toHaveBeenCalled();
  });

  it("다듬기에 성공하면 설명만 바뀌고 값은 요청 그대로", async () => {
    polish.mockResolvedValue("C장조로 밝게 시작해요.");
    const { status, json } = await call(body);

    expect(status).toBe(200);
    expect(json).toEqual({
      ...analysis,
      explanation: "C장조로 밝게 시작해요.",
      polished: true,
    });
    expect(supabase.rpc).toHaveBeenCalledWith("consume_llm_quota", {
      daily_limit: DAILY_POLISH_LIMIT,
      usage_kind: "polish",
    });
    expect(polish).toHaveBeenCalledWith(
      expect.objectContaining({ keyName: "C장조", styleLabel: "팝" }),
    );
  });

  it("API 키가 없으면 한도를 깎지 않고 규칙 엔진 설명 그대로", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "");
    expect((await call(body)).json).toEqual({ ...analysis, polished: false });
    expect(supabase.rpc).not.toHaveBeenCalled();
    expect(polish).not.toHaveBeenCalled();
  });

  it("한도를 다 썼으면 LLM 없이 limited", async () => {
    supabase.rpc.mockResolvedValue({ data: false, error: null });
    const { json } = await call(body);
    expect(json).toEqual({ ...analysis, polished: false, limited: true });
    expect(polish).not.toHaveBeenCalled();
  });

  it("다듬기 실패 · 한도 확인 오류는 규칙 엔진 설명 그대로", async () => {
    polish.mockResolvedValue(null);
    expect((await call(body)).json).toEqual({ ...analysis, polished: false });

    supabase.rpc.mockResolvedValue({ data: null, error: { message: "db" } });
    expect((await call(body)).json).toEqual({ ...analysis, polished: false });
  });
});

describe("POST /api/analyze 재추천 (명세 11)", () => {
  const melody = [{ pitch: 60, start: 0, duration: 4, velocity: 0.8 }];
  const ask = (request: unknown, extra: object = {}) =>
    call({ analysis, melody, request, ...extra });

  beforeEach(() => recommend.mockReset());

  it("모르는 request · 멜로디 없는 재추천은 400", async () => {
    expect((await ask("jazzier")).status).toBe(400);
    expect((await call({ analysis, request: "sadder" })).status).toBe(400);
    expect(recommend).not.toHaveBeenCalled();
  });

  it("성공하면 코드 · 설명만 바뀌고, 재추천 한도(recommend)를 씀", async () => {
    const chords = [
      { symbol: "Am", start: 0, duration: 16 },
      analysis.chords[1],
    ];
    recommend.mockResolvedValue({
      chords,
      explanation: "C장조 첫 마디를 Am으로 바꿨어요.",
      changed: 1,
    });
    const { json } = await ask("sadder");
    expect(supabase.rpc).toHaveBeenCalledWith("consume_llm_quota", {
      daily_limit: DAILY_RECOMMEND_LIMIT,
      usage_kind: "recommend",
    });
    expect(recommend).toHaveBeenCalledWith(
      expect.objectContaining({ melody, request: "sadder", key: "C major" }),
    );
    expect(json).toEqual({
      ...analysis,
      chords,
      explanation: "C장조 첫 마디를 Am으로 바꿨어요.",
      recommended: true,
      changed: 1,
    });
    expect(polish).not.toHaveBeenCalled();
  });

  it("실패하면 곡 그대로, 한도 초과는 limited, 키 없으면 한도 안 깎고 unavailable", async () => {
    recommend.mockResolvedValue(null);
    expect((await ask("brighter")).json).toEqual({
      ...analysis,
      recommended: false,
    });

    supabase.rpc.mockResolvedValue({ data: false, error: null });
    expect((await ask("brighter")).json).toEqual({
      ...analysis,
      recommended: false,
      limited: true,
    });

    supabase.rpc.mockClear();
    vi.stubEnv("ANTHROPIC_API_KEY", "");
    expect((await ask("brighter")).json).toEqual({
      ...analysis,
      recommended: false,
      unavailable: true,
    });
    expect(supabase.rpc).not.toHaveBeenCalled();
  });
});
