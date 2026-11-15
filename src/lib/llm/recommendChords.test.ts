// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Key } from "@/lib/music";
import type { Note } from "@/types/song";

const create = vi.hoisted(() => vi.fn());
vi.mock("@anthropic-ai/sdk", () => ({
  default: class {
    beta = { messages: { create } };
  },
}));

import {
  applySuggestions,
  recommendChords,
  recommendSummary,
  type RecommendInput,
} from "./recommendChords";

const C_MAJOR: Key = { tonic: 0, mode: "major" };
const bar = (b: number, pitches: number[]): Note[] =>
  pitches.map((pitch, i) => ({
    pitch,
    start: b * 16 + i * 4,
    duration: 4,
    velocity: 0.8,
  }));

// 0마디 도미솔, 1마디 파라도, 2마디 미, 3마디 비어 있음
const input: RecommendInput = {
  melody: [
    ...bar(0, [60, 64, 67]),
    ...bar(1, [65, 69, 72]),
    ...bar(2, [64, 64, 64, 64]),
  ],
  key: "C major",
  chords: ["C", "F", "C", "G"].map((symbol, b) => ({
    symbol,
    start: b * 16,
    duration: 16,
  })),
  request: "sadder",
  style: "pop",
  bpm: 100,
};

const reply = (value: unknown, stop_reason = "end_turn") => ({
  stop_reason,
  content: [
    {
      type: "text",
      text: typeof value === "string" ? value : JSON.stringify(value),
    },
  ],
});

beforeEach(() => {
  vi.stubEnv("ANTHROPIC_API_KEY", "test-key");
  create.mockReset();
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => vi.unstubAllEnvs());

describe("recommendSummary", () => {
  it("후보(빌려 온 화음 포함)와 구간마다 멜로디 · 검사를 통과하는 코드만 options로", () => {
    const summary = recommendSummary(input, C_MAJOR);
    expect(summary.key).toBe("C장조");
    expect(
      summary.candidates.some((c) => c.symbol === "Fm" && c.borrowed),
    ).toBe(true);
    expect(summary.sections[0].melody).toEqual(["C", "E", "G"]);
    // 첫 구간의 으뜸화음(C)은 그대로 둠
    expect(summary.sections[0].options).toEqual([]);
    // 미만 있는 2마디(C): 지금 코드는 빼고, 미를 품은 Em은 있음, 부딪히는 Eb · A♭(Fm)은 없음
    expect(summary.sections[2].options).not.toContain("C");
    expect(summary.sections[2].options).toContain("Em");
    expect(summary.sections[2].options).not.toContain("Eb");
    expect(summary.sections[2].options).not.toContain("Fm");
    // 빈 구간은 후보 전부(지금 코드 빼고)
    expect(summary.sections[3].options).toHaveLength(
      summary.candidates.length - 1,
    );
  });
});

describe("applySuggestions", () => {
  it("어울리는 제안 · 빈 구간 제안은 바꾸고, 부딪히는 제안 · 후보 밖 · 범위 밖은 버림", () => {
    const { chords, changed } = applySuggestions(input, C_MAJOR, [
      { index: 1, symbol: "Fm" }, // 점수는 0.7이지만 멜로디 라가 Fm의 라♭과 반음으로 부딪힘 → 버림
      { index: 2, symbol: "Eb" }, // 미만 부르는 마디에 Eb → 버림
      { index: 3, symbol: "Ab" }, // 멜로디 없는 마디 → 바꿈
      { index: 0, symbol: "Em" }, // 첫 구간의 으뜸화음 → 그대로 둠
      { index: 9, symbol: "C" },
      { index: 1, symbol: "Cmaj9" },
    ]);
    expect(chords.map((c) => c.symbol)).toEqual(["C", "F", "C", "Ab"]);
    expect(changed).toBe(1);
    expect(chords[3]).toEqual({ symbol: "Ab", start: 48, duration: 16 });
  });

  it("사용자가 넣은 후보 밖 코드도 원래 점수와 비교한다", () => {
    const custom = {
      ...input,
      chords: input.chords.map((c, i) =>
        i === 2 ? { ...c, symbol: "C7" } : c,
      ),
    };
    expect(
      applySuggestions(custom, C_MAJOR, [{ index: 2, symbol: "Eb" }]).changed,
    ).toBe(0);
  });
});

describe("recommendChords", () => {
  it("성공하면 바뀐 진행과 이유, 후보를 enum으로 보냄", async () => {
    create.mockResolvedValue(
      reply({
        changes: [{ index: 3, symbol: "Ab" }],
        reason: "C장조 끝을 Ab으로 바꿔 쓸쓸하게 했어요.",
      }),
    );
    const result = await recommendChords(input);
    expect(result).toEqual({
      chords: expect.arrayContaining([
        { symbol: "Ab", start: 48, duration: 16 },
      ]),
      changed: 1,
      explanation: "C장조 끝을 Ab으로 바꿔 쓸쓸하게 했어요.",
    });
    const schema = create.mock.calls[0][0].output_config.format.schema;
    expect(schema.properties.changes.items.properties.symbol.enum).toContain(
      "Bb",
    );
  });

  it("이유가 검사에 걸리면(진행에 없는 코드 이름) 규칙 엔진 설명으로", async () => {
    create.mockResolvedValue(
      reply({
        changes: [{ index: 3, symbol: "Ab" }],
        reason: "C장조에 Dm7을 넣었어요.",
      }),
    );
    const result = await recommendChords(input);
    expect(result!.explanation).not.toContain("Dm7");
    expect(result!.explanation).toContain("Ab");
  });

  it("키 이름 속 으뜸음(C장조의 C)은 진행에 C가 없어도 코드 이름으로 걸리지 않음", async () => {
    create.mockResolvedValue(
      reply({ changes: [], reason: "C장조 곡이라 그대로 뒀어요." }),
    );
    const noTonic = {
      ...input,
      chords: input.chords.map((c) => ({ ...c, symbol: "F" })),
    };
    expect((await recommendChords(noTonic))!.explanation).toBe(
      "C장조 곡이라 그대로 뒀어요.",
    );
  });

  it("형식 오류는 한 번 더 묻고, 두 번 다 틀리거나 거절 · 오류 · 키 없음이면 null", async () => {
    create.mockResolvedValue(reply("코드를 바꿨어요"));
    expect(await recommendChords(input)).toBeNull();
    expect(create).toHaveBeenCalledTimes(2);

    create.mockReset().mockResolvedValue(reply("", "refusal"));
    expect(await recommendChords(input)).toBeNull();

    create.mockReset().mockRejectedValue(new Error("timeout"));
    expect(await recommendChords(input)).toBeNull();
    expect(create).toHaveBeenCalledTimes(1);

    create.mockReset();
    vi.stubEnv("ANTHROPIC_API_KEY", "");
    expect(await recommendChords(input)).toBeNull();
    expect(create).not.toHaveBeenCalled();
  });
});
