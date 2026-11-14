// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const create = vi.hoisted(() => vi.fn());
vi.mock("@anthropic-ai/sdk", () => ({
  default: class {
    beta = { messages: { create } };
  },
}));

import {
  checkPolished,
  MAX_POLISHED_LENGTH,
  polishExplanation,
  type PolishInput,
} from "./polishExplanation";

const input: PolishInput = {
  explanation:
    "멜로디에 C, E, G 음이 많이 쓰여 다장조로 판단했습니다. 마디마다 … C → F → G → C로 진행합니다.",
  keyName: "다장조",
  chordSymbols: ["C", "F", "G", "C"],
  styleLabel: "팝",
  bpm: 100,
};

const reply = (text: string, stop_reason = "end_turn") => ({
  stop_reason,
  content: [{ type: "text", text }],
});

describe("checkPolished", () => {
  it("키 이름이 있고 원래 있던 코드 · 음 이름만 쓰면 통과", () => {
    expect(
      checkPolished(
        "멜로디에 C, E, G 음이 자주 나와서 다장조로 봤어요. C → F → G → C로 이어져요.",
        input,
      ),
    ).toBe(true);
  });

  it("키 이름이 빠지면 버림", () => {
    expect(checkPolished("밝은 곡이에요. C → F → G로 가요.", input)).toBe(
      false,
    );
  });

  it("원래 없던 코드(Am7)를 지어내면 버림, BPM 같은 낱말은 코드로 안 봄", () => {
    expect(checkPolished("다장조예요. 중간에 Am7을 넣었어요.", input)).toBe(
      false,
    );
    expect(checkPolished("다장조, 100BPM이에요.", input)).toBe(true);
  });

  it("비었거나 너무 길면 버림", () => {
    expect(checkPolished("   ", input)).toBe(false);
    expect(
      checkPolished("다장조".padEnd(MAX_POLISHED_LENGTH + 1, "가"), input),
    ).toBe(false);
  });
});

describe("polishExplanation", () => {
  beforeEach(() => {
    vi.stubEnv("ANTHROPIC_API_KEY", "test-key");
    vi.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  it("다듬은 문장을 돌려주고, Sonnet 5.5 · effort low · 거절 대비를 씀", async () => {
    create.mockResolvedValueOnce(reply("다장조로 밝게 시작해요."));
    expect(await polishExplanation(input)).toBe("다장조로 밝게 시작해요.");
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        model: "claude-sonnet-5-5",
        output_config: { effort: "low" },
        fallbacks: "default",
      }),
    );
  });

  it("검사에 걸리면 한 번 더 묻고, 두 번 다 걸리면 null", async () => {
    create
      .mockResolvedValueOnce(reply("밝은 곡이에요."))
      .mockResolvedValueOnce(reply("다장조예요."));
    expect(await polishExplanation(input)).toBe("다장조예요.");

    create
      .mockResolvedValueOnce(reply("밝은 곡이에요."))
      .mockResolvedValueOnce(reply("Am7을 넣었어요. 다장조."));
    expect(await polishExplanation(input)).toBeNull();
    expect(create).toHaveBeenCalledTimes(4);
  });

  it("거절 · 오류 · 키 없음은 null", async () => {
    create.mockResolvedValue(reply("", "refusal"));
    expect(await polishExplanation(input)).toBeNull();

    create.mockRejectedValueOnce(new Error("timeout"));
    expect(await polishExplanation(input)).toBeNull();

    vi.stubEnv("ANTHROPIC_API_KEY", "");
    create.mockClear();
    expect(await polishExplanation(input)).toBeNull();
    expect(create).not.toHaveBeenCalled();
  });
});
