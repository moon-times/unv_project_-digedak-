import { describe, expect, it } from "vitest";
import { NoteSchema } from "@/lib/schemas";
import { STYLES, type Chord, type Note } from "@/types/song";
import { generateAccompaniment } from "./generate";
import { DRUM } from "./patterns";

const progression = (...symbols: string[]): Chord[] =>
  symbols.map((symbol, bar) => ({ symbol, start: bar * 16, duration: 16 }));

const C_F_G_C = progression("C", "F", "G", "C");
const at = (notes: Note[], start: number) =>
  notes.filter((n) => n.start === start);

describe("generateAccompaniment", () => {
  it("모든 장르에서 스키마에 맞는 음표를 곡 길이 안에 만든다", () => {
    for (const style of STYLES) {
      const result = generateAccompaniment(C_F_G_C, style, 100);
      for (const track of [result.drums, result.bass, result.keys]) {
        expect(track.length).toBeGreaterThan(0);
        for (const note of track) {
          expect(NoteSchema.safeParse(note).success).toBe(true);
          expect(note.start + note.duration).toBeLessThanOrEqual(64);
        }
      }
    }
  });

  it("같은 입력이면 항상 같은 결과", () => {
    expect(generateAccompaniment(C_F_G_C, "pop", 100)).toEqual(
      generateAccompaniment(C_F_G_C, "pop", 100),
    );
  });

  it("장르마다 다른 반주", () => {
    const pop = generateAccompaniment(C_F_G_C, "pop", 100);
    const rock = generateAccompaniment(C_F_G_C, "rock", 100);
    const ballad = generateAccompaniment(C_F_G_C, "ballad", 100);
    expect(rock.bass.length).toBeGreaterThan(pop.bass.length);
    expect(ballad.drums.some((n) => n.pitch === DRUM.sideStick)).toBe(true);
    expect(pop.drums.some((n) => n.pitch === DRUM.sideStick)).toBe(false);
  });

  it("베이스와 건반은 마디의 코드를 따른다", () => {
    const { bass, keys } = generateAccompaniment(C_F_G_C, "pop", 100);
    expect(at(bass, 0)[0].pitch).toBe(36); // C2
    expect(at(bass, 16)[0].pitch).toBe(29); // F1
    expect(at(bass, 32)[0].pitch).toBe(31); // G1
    expect(
      at(keys, 0)
        .map((n) => n.pitch % 12)
        .sort(),
    ).toEqual([0, 4, 7]);
    expect(
      at(keys, 16)
        .map((n) => n.pitch % 12)
        .sort((a, b) => a - b),
    ).toEqual([0, 5, 9]);
  });

  it("2·4박에 스네어, 첫 박에 킥과 크래시 (팝)", () => {
    const { drums } = generateAccompaniment(C_F_G_C, "pop", 100);
    const pitchesAt = (step: number) => at(drums, step).map((n) => n.pitch);
    expect(pitchesAt(0)).toEqual(
      expect.arrayContaining([DRUM.kick, DRUM.crash]),
    );
    expect(pitchesAt(4)).toContain(DRUM.snare);
    expect(pitchesAt(12)).toContain(DRUM.snare);
    expect(pitchesAt(16)).not.toContain(DRUM.crash); // 크래시는 4마디마다
  });

  it("빠른 곡은 하이햇을 덜 친다", () => {
    const hats = (bpm: number) =>
      generateAccompaniment(C_F_G_C, "rock", bpm).drums.filter(
        (n) => n.pitch === DRUM.closedHat,
      ).length;
    expect(hats(150)).toBe(hats(120) / 2);
  });

  it("코드가 마디 중간에 끝나면 음도 그 안에서 끊는다", () => {
    const chords: Chord[] = [
      { symbol: "C", start: 0, duration: 8 },
      { symbol: "G", start: 8, duration: 8 },
    ];
    const { bass } = generateAccompaniment(chords, "ballad", 80);
    expect(bass).toEqual([
      { pitch: 36, start: 0, duration: 8, velocity: 0.75 },
      { pitch: 38, start: 8, duration: 8, velocity: 0.65 }, // G 코드의 5도 = D2
    ]);
  });

  it("읽을 수 없는 코드 구간은 베이스·건반을 쉬고 드럼은 계속", () => {
    const { drums, bass, keys } = generateAccompaniment(
      progression("C", "???"),
      "pop",
      100,
    );
    expect(bass.every((n) => n.start < 16)).toBe(true);
    expect(keys.every((n) => n.start < 16)).toBe(true);
    expect(drums.some((n) => n.start >= 16)).toBe(true);
  });

  it("3/4박자(12 step)는 마디 안의 패턴만 쓴다", () => {
    const chords: Chord[] = [
      { symbol: "C", start: 0, duration: 12 },
      { symbol: "G", start: 12, duration: 12 },
    ];
    const result = generateAccompaniment(chords, "pop", 100, {
      stepsPerBar: 12,
    });
    for (const note of [...result.drums, ...result.bass, ...result.keys]) {
      const barStart = Math.floor(note.start / 12) * 12;
      expect(note.start + note.duration).toBeLessThanOrEqual(barStart + 12);
    }
    expect(at(result.bass, 12)[0].pitch).toBe(31); // 둘째 마디는 G
  });

  it("빈 코드 진행이면 빈 반주, 잘못된 마디 길이는 4/4로", () => {
    expect(generateAccompaniment([], "pop", 100)).toEqual({
      drums: [],
      bass: [],
      keys: [],
    });
    expect(
      generateAccompaniment(C_F_G_C, "pop", 100, { stepsPerBar: 0 }),
    ).toEqual(generateAccompaniment(C_F_G_C, "pop", 100));
  });
});
