import { describe, expect, it } from "vitest";
import { assignChords, diatonicCandidates, scoreChordForNotes } from "./chords";
import { melodyOf } from "./testUtils";
import type { Key } from "./theory";

const C_MAJOR: Key = { tonic: 0, mode: "major" };
const A_MINOR: Key = { tonic: 9, mode: "minor" };
const C_MAJOR_SCALE = [0, 2, 4, 5, 7, 9, 11];

describe("diatonicCandidates", () => {
  it("C장조 후보는 C Dm Em F G Am", () => {
    expect(diatonicCandidates(C_MAJOR).map((c) => c.symbol)).toEqual([
      "C",
      "Dm",
      "Em",
      "F",
      "G",
      "Am",
    ]);
  });

  it("A단조 후보는 화성단음계의 V(E)를 쓴다", () => {
    expect(diatonicCandidates(A_MINOR).map((c) => c.symbol)).toEqual([
      "Am",
      "C",
      "Dm",
      "E",
      "F",
      "G",
    ]);
  });

  it("플랫 조에서는 플랫으로 적는다", () => {
    expect(
      diatonicCandidates({ tonic: 3, mode: "major" }).map((c) => c.symbol),
    ).toEqual(["Eb", "Fm", "Gm", "Ab", "Bb", "Cm"]);
  });
});

describe("scoreChordForNotes", () => {
  const bar = melodyOf([60, 4], [64, 4], [67, 8]);

  it("구성음만 있으면 높은 점수, 음계 밖 음이면 낮은 점수", () => {
    const cChord = scoreChordForNotes(bar, [0, 4, 7], C_MAJOR_SCALE, 0, 16);
    const gChord = scoreChordForNotes(bar, [7, 11, 2], C_MAJOR_SCALE, 0, 16);
    expect(cChord).toBeGreaterThan(0.9);
    expect(cChord).toBeGreaterThan(gChord);

    const outside = melodyOf([61, 16]); // C#
    expect(scoreChordForNotes(outside, [0, 4, 7], C_MAJOR_SCALE, 0, 16)).toBe(
      -1,
    );
  });

  it("구간에 음이 없으면 0", () => {
    expect(scoreChordForNotes(bar, [0, 4, 7], C_MAJOR_SCALE, 16, 32)).toBe(0);
  });

  it("앞 마디에서 이어진 음은 겹친 길이만큼만 센다", () => {
    const held = melodyOf([65, 20]); // F를 마디 경계 너머까지
    // 두 번째 마디(16~32)에는 F가 4 step만 걸림. F 코드면 +
    expect(
      scoreChordForNotes(held, [5, 9, 0], C_MAJOR_SCALE, 16, 32),
    ).toBeGreaterThan(0);
  });
});

describe("assignChords", () => {
  it("I-IV-V-I 아르페지오에 맞는 진행을 고른다", () => {
    const melody = melodyOf(
      [60, 4],
      [64, 4],
      [67, 8], // C
      [65, 4],
      [69, 4],
      [72, 8], // F
      [67, 4],
      [71, 4],
      [74, 8], // G
      [72, 16], // C
    );
    const result = assignChords(melody, C_MAJOR);
    expect(result.chords.map((c) => c.symbol)).toEqual(["C", "F", "G", "C"]);
    expect(result.romans).toEqual(["I", "IV", "V", "I"]);
    expect(result.chords[2]).toEqual({ symbol: "G", start: 32, duration: 16 });
  });

  it("마디 수는 마지막 음이 끝나는 위치로 정한다", () => {
    const melody = melodyOf([60, 4], [null, 30], [67, 2]); // 36 step → 3마디
    expect(assignChords(melody, C_MAJOR).chords).toHaveLength(3);
  });

  it("빈 마디가 있어도 진행을 만든다", () => {
    const melody = melodyOf(
      [60, 16],
      [null, 16],
      [67, 4],
      [71, 4],
      [74, 8],
      [72, 16],
    );
    const symbols = assignChords(melody, C_MAJOR).chords.map((c) => c.symbol);
    expect(symbols).toHaveLength(4);
    expect(symbols[0]).toBe("C");
    expect(symbols[3]).toBe("C");
  });

  it("단조 멜로디에는 i, V가 나온다", () => {
    const melody = melodyOf(
      [69, 4],
      [72, 4],
      [76, 8], // Am
      [71, 4],
      [68, 4],
      [64, 8], // E (G# 포함)
      [69, 16], // Am
    );
    expect(assignChords(melody, A_MINOR).chords.map((c) => c.symbol)).toEqual([
      "Am",
      "E",
      "Am",
    ]);
  });

  it("마디 길이를 바꿀 수 있다 (3/4박자 = 12 step)", () => {
    const melody = melodyOf([60, 12], [67, 12]);
    const { chords } = assignChords(melody, C_MAJOR, 12);
    expect(chords.map((c) => [c.start, c.duration])).toEqual([
      [0, 12],
      [12, 12],
    ]);
  });

  it("빈 멜로디는 빈 진행", () => {
    expect(assignChords([], C_MAJOR)).toEqual({ chords: [], romans: [] });
  });
});
