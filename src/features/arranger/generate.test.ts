import { describe, expect, it } from "vitest";
import { NoteSchema } from "@/lib/schemas";
import {
  STYLES,
  type ArrangementPlan,
  type ArrangementSection,
  type Chord,
  type Note,
} from "@/types/song";
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
      guitar: [],
    });
    expect(
      generateAccompaniment(C_F_G_C, "pop", 100, { stepsPerBar: 0 }),
    ).toEqual(generateAccompaniment(C_F_G_C, "pop", 100));
  });
});

describe("기타", () => {
  const guitarOf = (style: (typeof STYLES)[number]) =>
    generateAccompaniment(C_F_G_C, style, 100).guitar;

  it("모든 장르에 기타 줄이 있고, 기타 음역(E2~E5) 안에 있다", () => {
    for (const style of STYLES) {
      const guitar = guitarOf(style);
      expect(guitar.length).toBeGreaterThan(0);
      for (const note of guitar) {
        expect(note.pitch).toBeGreaterThanOrEqual(40);
        expect(note.pitch).toBeLessThanOrEqual(76);
      }
    }
  });

  it("팝은 다운 스트로크에 6줄, 업 스트로크에 높은 3줄을 친다", () => {
    const guitar = guitarOf("pop");
    expect(at(guitar, 0).map((n) => n.pitch)).toEqual([48, 55, 60, 64, 67, 72]);
    expect(at(guitar, 6).map((n) => n.pitch)).toEqual([64, 67, 72]);
  });

  it("록은 8분음표마다 파워코드(근음 · 5도 · 옥타브)", () => {
    const guitar = guitarOf("rock");
    for (let step = 0; step < 16; step += 2)
      expect(at(guitar, step).map((n) => n.pitch)).toEqual([48, 55, 60]);
    // 둘째 마디는 F 코드
    expect(at(guitar, 16).map((n) => n.pitch)).toEqual([41, 48, 53]);
  });

  it("발라드는 한 번에 한두 줄만 뜯는다", () => {
    for (let step = 0; step < 64; step += 4)
      expect(at(guitarOf("ballad"), step).length).toBeLessThanOrEqual(2);
  });
});

describe("편곡 계획 (명세 08)", () => {
  const section = (
    startBar: number,
    endBar: number,
    patch: Partial<ArrangementSection> = {},
  ): ArrangementSection => ({
    startBar,
    endBar,
    role: "verse",
    energy: 4,
    drums: "normal",
    bass: "normal",
    keys: "normal",
    guitar: "normal",
    fillAtEnd: false,
    crashAtStart: false,
    ...patch,
  });
  const plan = (
    sections: ArrangementSection[],
    patch: Partial<ArrangementPlan> = {},
  ): ArrangementPlan => ({
    sections,
    endingHit: false,
    summary: "",
    enabled: true,
    ...patch,
  });
  const inBar = (notes: Note[], bar: number, steps = 16) =>
    notes.filter((n) => n.start >= bar * steps && n.start < (bar + 1) * steps);
  const withPlan = (
    p: ArrangementPlan,
    style: "pop" | "rock" | "ballad" = "pop",
  ) => generateAccompaniment(C_F_G_C, style, 100, { plan: p });

  it("모두 normal · 세기 4면 계획 없는 반주와 같다 (크래시 규칙만 계획을 따름)", () => {
    const base = generateAccompaniment(C_F_G_C, "pop", 100);
    const planned = withPlan(plan([section(0, 4, { crashAtStart: true })]));
    expect(planned.bass).toEqual(base.bass);
    expect(planned.keys).toEqual(base.keys);
    expect(planned.guitar).toEqual(base.guitar);
    expect(planned.drums.filter((n) => n.pitch !== DRUM.crash)).toEqual(
      base.drums.filter((n) => n.pitch !== DRUM.crash),
    );
  });

  it("enabled: false면 계획을 무시한다", () => {
    const off = plan([section(0, 4, { drums: "none" })], {
      enabled: false,
      endingHit: true,
    });
    expect(withPlan(off)).toEqual(generateAccompaniment(C_F_G_C, "pop", 100));
  });

  it("구간 경계마다 설정이 바뀐다: 쉼 → 길게 → 옥타브", () => {
    const result = withPlan(
      plan([
        section(0, 1, {
          drums: "none",
          bass: "rest",
          keys: "rest",
          guitar: "rest",
        }),
        section(1, 2, { bass: "long", keys: "pad" }),
        section(2, 4, { bass: "octave", drums: "double", guitar: "power" }),
      ]),
    );
    for (const track of [result.drums, result.bass, result.keys, result.guitar])
      expect(inBar(track, 0)).toEqual([]);
    expect(inBar(result.bass, 1)).toHaveLength(1);
    expect(inBar(result.bass, 1)[0].duration).toBe(16);
    expect(new Set(inBar(result.keys, 1).map((n) => n.start))).toEqual(
      new Set([16]),
    );
    const octave = inBar(result.bass, 2);
    expect(octave).toHaveLength(8);
    expect(octave[1].pitch - octave[0].pitch).toBe(12);
    const kicks = inBar(result.drums, 2).filter((n) => n.pitch === DRUM.kick);
    for (const beat of [32, 36, 40, 44])
      expect(kicks.some((n) => n.start === beat)).toBe(true);
    expect(
      inBar(result.drums, 2).filter((n) => n.pitch === DRUM.closedHat),
    ).toHaveLength(16);
    expect(inBar(result.guitar, 2).every((n) => n.duration === 2)).toBe(true);
  });

  it("half: 킥 첫 박 · 스네어 3박, 하이햇 4분", () => {
    const bar = inBar(
      withPlan(plan([section(0, 4, { drums: "half" })])).drums,
      0,
    );
    expect(
      bar.filter((n) => n.pitch === DRUM.kick).map((n) => n.start),
    ).toEqual([0]);
    expect(
      bar.filter((n) => n.pitch === DRUM.snare).map((n) => n.start),
    ).toEqual([8]);
    expect(bar.filter((n) => n.pitch === DRUM.closedHat)).toHaveLength(4);
  });

  it("세기가 낮을수록 음이 약하다", () => {
    const soft = withPlan(plan([section(0, 4, { energy: 1 })]));
    const loud = withPlan(plan([section(0, 4, { energy: 5 })]));
    expect(soft.bass[0].velocity).toBeLessThan(loud.bass[0].velocity);
    for (const note of loud.drums) expect(note.velocity).toBeLessThanOrEqual(1);
  });

  it("필인은 구간 마지막 마디 끝 1박을 탐으로 바꾸고, 크래시는 구간 첫 박", () => {
    const result = withPlan(
      plan([
        section(0, 2, { fillAtEnd: true }),
        section(2, 4, { crashAtStart: true }),
      ]),
    );
    const fill = result.drums.filter((n) => n.start >= 28 && n.start < 32);
    expect(fill.map((n) => n.start)).toEqual([28, 29, 30, 31]);
    expect(
      fill.every((n) => n.pitch !== DRUM.kick && n.pitch !== DRUM.closedHat),
    ).toBe(true);
    expect(fill[3].velocity).toBeGreaterThan(fill[0].velocity);
    // 첫 구간 첫 마디(필인 아님)는 그대로
    expect(
      result.drums.some((n) => n.start === 12 && n.pitch === DRUM.snare),
    ).toBe(true);
    const crashes = result.drums
      .filter((n) => n.pitch === DRUM.crash)
      .map((n) => n.start);
    expect(crashes).toEqual([32]);
  });

  it("끝 한 방: 마지막 마디는 첫 박에만 치고 길게", () => {
    const last = (notes: Note[]) => inBar(notes, 3);
    const result = withPlan(plan([section(0, 4)], { endingHit: true }));
    for (const track of [result.drums, result.bass, result.keys, result.guitar])
      expect(last(track).every((n) => n.start === 48)).toBe(true);
    expect(
      last(result.drums)
        .map((n) => n.pitch)
        .sort(),
    ).toEqual([DRUM.kick, DRUM.crash]);
    expect(last(result.bass)[0].duration).toBe(16);
  });

  it("3/4박자에서도 마디 밖 음이 없다", () => {
    const chords = [0, 1, 2, 3].map((bar) => ({
      symbol: "C",
      start: bar * 12,
      duration: 12,
    }));
    const result = generateAccompaniment(chords, "rock", 100, {
      stepsPerBar: 12,
      plan: plan(
        [
          section(0, 2, {
            drums: "double",
            bass: "octave",
            keys: "arpeggio",
            fillAtEnd: true,
          }),
          section(2, 4, { guitar: "arpeggio" }),
        ],
        { endingHit: true },
      ),
    });
    for (const track of [result.drums, result.bass, result.keys, result.guitar])
      for (const note of track) {
        const bar = Math.floor(note.start / 12);
        expect(note.start + note.duration).toBeLessThanOrEqual((bar + 1) * 12);
      }
  });
});
