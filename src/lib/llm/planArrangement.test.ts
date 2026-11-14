// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createEmptySong,
  type ArrangementSection,
  type SongState,
} from "@/types/song";

const create = vi.hoisted(() => vi.fn());
vi.mock("@anthropic-ai/sdk", () => ({
  default: class {
    beta = { messages: { create } };
  },
}));

import {
  normalizePlan,
  planArrangement,
  summarizeSong,
  type ArrangementDraft,
} from "./planArrangement";

const section = (
  startBar: number,
  endBar: number,
  patch: Partial<ArrangementSection> = {},
): ArrangementSection => ({
  startBar,
  endBar,
  role: "verse",
  energy: 3,
  drums: "normal",
  bass: "normal",
  keys: "normal",
  guitar: "normal",
  fillAtEnd: false,
  crashAtStart: false,
  ...patch,
});
const draft = (sections: ArrangementSection[]): ArrangementDraft => ({
  sections,
  endingHit: true,
  summary: " 조용히 시작해 코러스에서 크게 키웠어요. ",
});

// 4마디: 0~1마디는 낮고 드문 멜로디, 2~3마디는 높고 촘촘한 멜로디
const song: SongState = {
  ...createEmptySong(),
  melody: [
    { pitch: 60, start: 0, duration: 8, velocity: 0.8 },
    { pitch: 62, start: 16, duration: 4, velocity: 0.8 },
    ...[0, 2, 4, 6, 8, 10, 12, 14].map((s) => ({
      pitch: 72,
      start: 32 + s,
      duration: 2,
      velocity: 0.8,
    })),
    { pitch: 74, start: 48, duration: 16, velocity: 0.8 },
  ],
  chords: ["C", "F", "G", "C"].map((symbol, bar) => ({
    symbol,
    start: bar * 16,
    duration: 16,
  })),
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

describe("summarizeSong", () => {
  it("마디마다 코드 · 음 개수 · 평균 음높이 · 쉬는 비율", () => {
    const summary = summarizeSong(song);
    expect(summary.barCount).toBe(4);
    expect(summary.bars[0]).toEqual({
      bar: 0,
      chord: "C",
      notes: 1,
      avgPitch: 60,
      rest: 0.5,
    });
    expect(summary.bars[2]).toMatchObject({
      chord: "G",
      notes: 8,
      avgPitch: 72,
      rest: 0,
    });
  });
});

describe("normalizePlan", () => {
  it("범위 밖은 곡 안으로 자르고 순서대로 정렬", () => {
    const plan = normalizePlan(draft([section(2, 9), section(-1, 2)]), 4)!;
    expect(plan.sections.map((s) => [s.startBar, s.endBar])).toEqual([
      [0, 2],
      [2, 4],
    ]);
    expect(plan.summary).toBe("조용히 시작해 코러스에서 크게 키웠어요.");
  });

  it("겹치면 앞 구간을 살리고, 다 가려진 구간은 버림", () => {
    const plan = normalizePlan(
      draft([section(0, 3), section(1, 2), section(2, 4)]),
      4,
    )!;
    expect(plan.sections.map((s) => [s.startBar, s.endBar])).toEqual([
      [0, 3],
      [3, 4],
    ]);
  });

  it("남는 구간이 없으면 null", () => {
    expect(normalizePlan(draft([section(5, 8)]), 4)).toBeNull();
    expect(normalizePlan(draft([]), 4)).toBeNull();
  });
});

describe("planArrangement", () => {
  it("성공하면 정리된 계획, 곡 요약을 보냄", async () => {
    create.mockResolvedValue(
      reply(draft([section(0, 2, { energy: 1 }), section(2, 4)])),
    );
    const plan = await planArrangement(song);
    expect(plan?.sections).toHaveLength(2);
    const request = create.mock.calls[0][0];
    expect(request.output_config.format.type).toBe("json_schema");
    expect(JSON.parse(request.messages[0].content).barCount).toBe(4);
  });

  it("형식이 틀리면 한 번 더 묻고, 두 번 다 틀리면 null", async () => {
    create
      .mockResolvedValueOnce(
        reply({ sections: [{ ...section(0, 4), energy: 9 }] }),
      )
      .mockResolvedValueOnce(reply(draft([section(0, 4)])));
    expect(await planArrangement(song)).not.toBeNull();
    expect(create).toHaveBeenCalledTimes(2);

    create.mockReset().mockResolvedValue(reply("편곡 계획입니다"));
    expect(await planArrangement(song)).toBeNull();
    expect(create).toHaveBeenCalledTimes(2);
  });

  it("거절 · 오류면 null", async () => {
    create.mockResolvedValue(reply("", "refusal"));
    expect(await planArrangement(song)).toBeNull();
    create.mockReset().mockRejectedValue(new Error("timeout"));
    expect(await planArrangement(song)).toBeNull();
    expect(create).toHaveBeenCalledTimes(1);
  });

  it("키가 없거나 빈 곡이면 부르지 않음", async () => {
    expect(await planArrangement(createEmptySong())).toBeNull();
    vi.stubEnv("ANTHROPIC_API_KEY", "");
    expect(await planArrangement(song)).toBeNull();
    expect(create).not.toHaveBeenCalled();
  });
});
