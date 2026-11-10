import { describe, expect, test } from "vitest";
import { createEmptySong } from "@/types/song";
import {
  LABEL_WIDTH,
  MIN_BARS,
  MIN_STEP_WIDTH,
  STEP_WIDTH,
  fitStepWidth,
  noteName,
  pitchRange,
  timelineSteps,
} from "./layout";

const note = (pitch: number, start = 0, duration = 4) => ({
  pitch,
  start,
  duration,
  velocity: 0.8,
});

describe("noteName", () => {
  test("MIDI 번호를 음 이름으로", () => {
    expect(noteName(60)).toBe("C4");
    expect(noteName(69)).toBe("A4");
    expect(noteName(61)).toBe("C#4");
    expect(noteName(0)).toBe("C-1");
  });
});

describe("timelineSteps", () => {
  test("빈 곡도 최소 마디 수만큼 보여 준다", () => {
    expect(timelineSteps(createEmptySong())).toBe(MIN_BARS * 16);
  });

  test("곡이 길면 마지막 음이 들어가는 마디까지", () => {
    // 140 + 4 = 144 step → 9마디
    const song = { ...createEmptySong(), melody: [note(60, 140, 4)] };
    expect(timelineSteps(song)).toBe(9 * 16);
  });

  test("3/4박자는 한 마디가 12 step", () => {
    const song = {
      ...createEmptySong(),
      timeSignature: [3, 4] as [number, number],
    };
    expect(timelineSteps(song)).toBe(MIN_BARS * 12);
  });
});

describe("pitchRange", () => {
  test("음표가 없으면 C4부터 한 옥타브", () => {
    expect(pitchRange([])).toEqual([60, 71]);
  });

  test("음역이 좁으면 최소 폭까지 위아래로 넓힌다", () => {
    const [low, high] = pitchRange([note(60), note(62)]);
    expect(high - low + 1).toBe(12);
    expect(low).toBeLessThan(60);
    expect(high).toBeGreaterThan(62);
  });

  test("음역이 넓으면 위아래 한 음씩만 여유를 둔다", () => {
    expect(pitchRange([note(55), note(79)])).toEqual([54, 80]);
  });
});

describe("fitStepWidth", () => {
  test("칸 폭을 모르면 기본 폭", () => {
    expect(fitStepWidth(0, 128)).toBe(STEP_WIDTH);
  });

  test("이름 칸을 뺀 폭에 전체 길이가 꽉 차게", () => {
    expect(fitStepWidth(LABEL_WIDTH + 1280, 128)).toBe(10);
  });

  test("곡이 길어 너무 좁아지면 최소 폭 (가로 스크롤)", () => {
    expect(fitStepWidth(LABEL_WIDTH + 1000, 1000)).toBe(MIN_STEP_WIDTH);
  });
});
