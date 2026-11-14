import { describe, expect, test } from "vitest";
import type { Chord, Note } from "@/types/song";
import { chordChoices, normalizeChordSymbol, replaceChord } from "./chordEdit";

const note = (pitch: number, start: number, duration = 4): Note => ({
  pitch,
  start,
  duration,
  velocity: 0.8,
});

describe("normalizeChordSymbol", () => {
  test.each([
    ["Am", "Am"],
    ["am", "Am"],
    [" f#m7 ", "F#m7"],
    ["Amin7", "Am7"],
    ["CM7", "Cmaj7"],
    ["Bb", "Bb"],
    ["Bm7b5", "Bm7b5"],
    ["C/E", "C/E"],
    ["Db/Ab", "Db/Ab"],
  ])("%s → %s", (input, expected) => {
    expect(normalizeChordSymbol(input)).toBe(expected);
  });

  test.each(["", "H", "Cxyz", "C/", "도"])(
    "읽을 수 없으면 null: %j",
    (input) => {
      expect(normalizeChordSymbol(input)).toBeNull();
    },
  );
});

describe("chordChoices", () => {
  const bar: Chord = { symbol: "C", start: 0, duration: 16 };

  test("장조는 I ii iii IV V vi 순서로 키 안의 코드를 준다", () => {
    expect(chordChoices("C major", [], bar).map((c) => c.symbol)).toEqual([
      "C",
      "Dm",
      "Em",
      "F",
      "G",
      "Am",
    ]);
  });

  test("단조 · 플랫 키도 그 키 표기로", () => {
    const choices = chordChoices("F minor", [], bar);
    expect(choices.map((c) => c.roman)).toEqual([
      "i",
      "III",
      "iv",
      "V",
      "VI",
      "VII",
    ]);
    expect(choices[0].symbol).toBe("Fm");
    expect(choices[1].symbol).toBe("Ab");
  });

  test("구간 멜로디가 구성음이면 점수가 높고, 음이 없으면 점수 없음", () => {
    // 도 · 미 · 솔 → C가 G보다 잘 맞음
    const melody = [note(60, 0), note(64, 4), note(67, 8)];
    const choices = chordChoices("C major", melody, bar);
    const score = (symbol: string) =>
      choices.find((c) => c.symbol === symbol)!.score!;
    expect(score("C")).toBeGreaterThan(score("G"));

    const empty = chordChoices("C major", melody, {
      symbol: "F",
      start: 16,
      duration: 16,
    });
    expect(empty.every((c) => c.score === null)).toBe(true);
  });

  test("키를 읽을 수 없으면 빈 목록", () => {
    expect(chordChoices("???", [], bar)).toEqual([]);
  });
});

describe("replaceChord", () => {
  const chords: Chord[] = [
    { symbol: "C", start: 0, duration: 16 },
    { symbol: "G", start: 16, duration: 16 },
  ];

  test("그 코드의 기호만 바꾸고 위치 · 길이는 그대로", () => {
    expect(replaceChord(chords, 1, "Em")).toEqual([
      chords[0],
      { symbol: "Em", start: 16, duration: 16 },
    ]);
  });

  test("같은 기호거나 없는 위치면 원래 배열 그대로 (저장이 다시 일어나지 않게)", () => {
    expect(replaceChord(chords, 0, "C")).toBe(chords);
    expect(replaceChord(chords, 5, "Am")).toBe(chords);
  });
});
