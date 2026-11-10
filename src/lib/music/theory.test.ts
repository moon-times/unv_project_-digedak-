import { describe, expect, it } from "vitest";
import {
  chordPitchClasses,
  chordSymbol,
  keyName,
  parseChordSymbol,
  parseKey,
  pitchClass,
  scalePitchClasses,
} from "./theory";

describe("pitchClass", () => {
  it("MIDI 번호를 0~11로 바꾼다", () => {
    expect(pitchClass(60)).toBe(0);
    expect(pitchClass(69)).toBe(9);
    expect(pitchClass(-1)).toBe(11);
  });
});

describe("키 이름", () => {
  it("플랫 조는 플랫으로, 샵 조는 샵으로 적는다", () => {
    expect(keyName({ tonic: 10, mode: "major" })).toBe("Bb major");
    expect(keyName({ tonic: 6, mode: "major" })).toBe("F# major");
    expect(keyName({ tonic: 2, mode: "minor" })).toBe("D minor");
    expect(keyName({ tonic: 1, mode: "minor" })).toBe("C# minor");
  });

  it("keyName과 parseKey는 서로 되돌린다", () => {
    for (const mode of ["major", "minor"] as const) {
      for (let tonic = 0; tonic < 12; tonic++) {
        expect(parseKey(keyName({ tonic, mode }))).toEqual({ tonic, mode });
      }
    }
  });

  it("형식이 다르면 null", () => {
    expect(parseKey("C")).toBeNull();
    expect(parseKey("H major")).toBeNull();
  });
});

describe("스케일", () => {
  it("A단조 자연단음계", () => {
    expect(scalePitchClasses({ tonic: 9, mode: "minor" })).toEqual([
      9, 11, 0, 2, 4, 5, 7,
    ]);
  });
});

describe("코드 기호", () => {
  it("기본 코드를 읽는다", () => {
    expect(parseChordSymbol("C")).toEqual({ root: 0, quality: "maj" });
    expect(parseChordSymbol("Am")).toEqual({ root: 9, quality: "min" });
    expect(parseChordSymbol("Bdim")).toEqual({ root: 11, quality: "dim" });
  });

  it("세븐스, 다른 표기, 슬래시 코드를 읽는다", () => {
    expect(chordPitchClasses(parseChordSymbol("Cmaj7")!)).toEqual([
      0, 4, 7, 11,
    ]);
    expect(parseChordSymbol("F#m7b5")).toEqual({ root: 6, quality: "m7b5" });
    expect(parseChordSymbol("Bbmin7")).toEqual({ root: 10, quality: "m7" });
    expect(parseChordSymbol("C/E")).toEqual({
      root: 0,
      quality: "maj",
      bass: 4,
    });
  });

  it("읽을 수 없는 기호는 null", () => {
    expect(parseChordSymbol("H")).toBeNull();
    expect(parseChordSymbol("Cxyz")).toBeNull();
    expect(parseChordSymbol("")).toBeNull();
  });

  it("chordSymbol은 parseChordSymbol을 되돌린다", () => {
    for (const symbol of ["C", "Am", "Ebmaj7", "G7", "Bdim", "C/E"]) {
      expect(
        chordSymbol(parseChordSymbol(symbol)!, symbol.startsWith("Eb")),
      ).toBe(symbol);
    }
  });
});
