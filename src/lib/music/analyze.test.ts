import { describe, expect, it } from "vitest";
import { AnalysisResultSchema } from "@/lib/schemas";
import { analyzeSong } from "./analyze";
import { recommendStyle, suggestBpm } from "./style";
import { melodyOf } from "./testUtils";

const TUNE = melodyOf(
  [60, 4],
  [64, 4],
  [67, 8],
  [65, 4],
  [69, 4],
  [72, 8],
  [67, 4],
  [71, 4],
  [74, 8],
  [72, 16],
);

describe("analyzeSong", () => {
  it("AnalysisResult 스키마에 맞는 결과를 돌려준다", () => {
    const result = analyzeSong(TUNE, 100);
    expect(AnalysisResultSchema.safeParse(result).success).toBe(true);
    expect(result.key).toBe("C major");
    expect(result.chords.map((c) => c.symbol)).toEqual(["C", "F", "G", "C"]);
    expect(result.recommendedStyle).toBe("pop");
    expect(result.bpmSuggestion).toBe(100);
  });

  it("설명에 키, 진행, 스타일 근거가 들어간다", () => {
    const { explanation } = analyzeSong(TUNE, 100);
    expect(explanation).toContain("C장조");
    expect(explanation).toContain("C → F → G → C");
    expect(explanation).toContain("팝");
    expect(explanation).toContain("100BPM");
  });

  it("느린 템포는 발라드", () => {
    const result = analyzeSong(TUNE, 72);
    expect(result.recommendedStyle).toBe("ballad");
    expect(result.bpmSuggestion).toBe(72);
  });

  it("빈 멜로디도 스키마에 맞는 기본값을 돌려준다", () => {
    const result = analyzeSong([], 100);
    expect(AnalysisResultSchema.safeParse(result).success).toBe(true);
    expect(result.chords).toEqual([]);
    expect(result.explanation).toContain("멜로디가 비어 있어");
  });

  it("BPM이 잘못 들어와도 기본 템포로 분석한다", () => {
    expect(analyzeSong(TUNE, 0).bpmSuggestion).toBe(100);
    expect(analyzeSong(TUNE, Number.NaN).bpmSuggestion).toBe(100);
  });
});

describe("스타일 규칙", () => {
  it("빠르면 록, 느리면 발라드, 중간은 팝", () => {
    expect(recommendStyle({ bpm: 140, mode: "major", notesPerBar: 4 })).toBe(
      "rock",
    );
    expect(recommendStyle({ bpm: 115, mode: "major", notesPerBar: 8 })).toBe(
      "rock",
    );
    expect(recommendStyle({ bpm: 115, mode: "major", notesPerBar: 3 })).toBe(
      "pop",
    );
    expect(recommendStyle({ bpm: 80, mode: "major", notesPerBar: 4 })).toBe(
      "ballad",
    );
    expect(recommendStyle({ bpm: 95, mode: "minor", notesPerBar: 4 })).toBe(
      "ballad",
    );
  });

  it("추천 BPM은 장르 범위 안으로 맞춘다", () => {
    expect(suggestBpm("ballad", 120)).toBe(90);
    expect(suggestBpm("rock", 100.4)).toBe(110);
    expect(suggestBpm("pop", 101.6)).toBe(102);
  });
});
