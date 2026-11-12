import { describe, expect, test } from "vitest";
import { createEmptySong } from "@/types/song";
import {
  countBars,
  formatTime,
  songDurationSeconds,
  songEndStep,
  stepsPerBar,
} from "./transport";

const note = (start: number, duration: number) => ({
  pitch: 60,
  start,
  duration,
  velocity: 0.8,
});

describe("stepsPerBar", () => {
  test("박자표에 따라 한 마디의 16분음표 수를 계산한다", () => {
    expect(stepsPerBar([4, 4])).toBe(16);
    expect(stepsPerBar([3, 4])).toBe(12);
    expect(stepsPerBar([6, 8])).toBe(12);
  });
});

describe("곡 길이", () => {
  test("빈 곡은 0마디, 0초", () => {
    const song = createEmptySong();
    expect(songEndStep(song)).toBe(0);
    expect(countBars(song)).toBe(0);
    expect(songDurationSeconds(song)).toBe(0);
  });

  test("멜로디·코드·반주 중 가장 늦게 끝나는 음까지 센다", () => {
    const song = {
      ...createEmptySong(),
      melody: [note(0, 4), note(100, 6)],
      chords: [{ symbol: "C", start: 96, duration: 16 }],
      accompaniment: { drums: [note(120, 2)], bass: [], keys: [], guitar: [] },
    };
    expect(songEndStep(song)).toBe(122);
    expect(countBars(song)).toBe(8);
  });

  test("84 BPM 4/4박자 8마디는 약 23초 (목업 예시)", () => {
    const song = { ...createEmptySong(), bpm: 84, melody: [note(0, 128)] };
    expect(countBars(song)).toBe(8);
    expect(formatTime(songDurationSeconds(song))).toBe("0:23");
  });
});

describe("formatTime", () => {
  test("분:초 두 자리로 표시한다", () => {
    expect(formatTime(0)).toBe("0:00");
    expect(formatTime(9.4)).toBe("0:09");
    expect(formatTime(75)).toBe("1:15");
  });
});
