// 음악 이론 기본 유틸: 음이름, 키, 스케일, 코드 기호 ↔ 구성음.
// 분석 엔진(key.ts, chords.ts)과 반주 엔진(features/arranger)이 함께 씁니다.

/** 0 = C, 1 = C#/Db, ..., 11 = B */
export type PitchClass = number;

export type Mode = "major" | "minor";
export type Key = { tonic: PitchClass; mode: Mode };

const SHARP_NAMES = [
  "C",
  "C#",
  "D",
  "D#",
  "E",
  "F",
  "F#",
  "G",
  "G#",
  "A",
  "A#",
  "B",
];
const FLAT_NAMES = [
  "C",
  "Db",
  "D",
  "Eb",
  "E",
  "F",
  "Gb",
  "G",
  "Ab",
  "A",
  "Bb",
  "B",
];

const NAME_TO_PC: Record<string, PitchClass> = {};
SHARP_NAMES.forEach((name, pc) => (NAME_TO_PC[name] = pc));
FLAT_NAMES.forEach((name, pc) => (NAME_TO_PC[name] = pc));

export function pitchClass(midi: number): PitchClass {
  return ((midi % 12) + 12) % 12;
}

/** 음이름("C#", "Bb")을 pitch class로. 모르는 이름이면 null */
export function parsePitchClass(name: string): PitchClass | null {
  return NAME_TO_PC[name] ?? null;
}

export function pitchClassName(pc: PitchClass, flats = false): string {
  return (flats ? FLAT_NAMES : SHARP_NAMES)[pitchClass(pc)];
}

// 플랫 조표를 쓰는 장조의 으뜸음: F, Bb, Eb, Ab, Db (Gb/F#은 F#으로 표기)
const FLAT_MAJOR_TONICS = new Set([5, 10, 3, 8, 1]);

/** 이 키에서 음이름을 플랫으로 적는지. 단조는 나란한조(관계 장조)를 따릅니다. */
export function usesFlats(key: Key): boolean {
  const relativeMajor =
    key.mode === "major" ? key.tonic : pitchClass(key.tonic + 3);
  return FLAT_MAJOR_TONICS.has(relativeMajor);
}

/** { tonic: 0, mode: "major" } → "C major" (SongState.key 형식) */
export function keyName(key: Key): string {
  return `${pitchClassName(key.tonic, usesFlats(key))} ${key.mode}`;
}

/** "C major", "F# minor" → Key. 형식이 다르면 null */
export function parseKey(name: string): Key | null {
  const match = /^([A-G][#b]?)\s+(major|minor)$/.exec(name.trim());
  if (!match) return null;
  const tonic = parsePitchClass(match[1]);
  if (tonic === null) return null;
  return { tonic, mode: match[2] as Mode };
}

const MAJOR_SCALE = [0, 2, 4, 5, 7, 9, 11];
const NATURAL_MINOR_SCALE = [0, 2, 3, 5, 7, 8, 10];

/** 키의 음계 구성음 7개 (단조는 자연단음계) */
export function scalePitchClasses(key: Key): PitchClass[] {
  const intervals = key.mode === "major" ? MAJOR_SCALE : NATURAL_MINOR_SCALE;
  return intervals.map((interval) => pitchClass(key.tonic + interval));
}

export type ChordQuality =
  | "maj"
  | "min"
  | "dim"
  | "aug"
  | "sus2"
  | "sus4"
  | "7"
  | "maj7"
  | "m7"
  | "m7b5"
  | "dim7";

/** 근음에서 각 구성음까지의 반음 거리 */
export const CHORD_INTERVALS: Record<ChordQuality, number[]> = {
  maj: [0, 4, 7],
  min: [0, 3, 7],
  dim: [0, 3, 6],
  aug: [0, 4, 8],
  sus2: [0, 2, 7],
  sus4: [0, 5, 7],
  "7": [0, 4, 7, 10],
  maj7: [0, 4, 7, 11],
  m7: [0, 3, 7, 10],
  m7b5: [0, 3, 6, 10],
  dim7: [0, 3, 6, 9],
};

/** 코드 기호를 만들 때 쓰는 접미사 */
const QUALITY_SUFFIX: Record<ChordQuality, string> = {
  maj: "",
  min: "m",
  dim: "dim",
  aug: "aug",
  sus2: "sus2",
  sus4: "sus4",
  "7": "7",
  maj7: "maj7",
  m7: "m7",
  m7b5: "m7b5",
  dim7: "dim7",
};

/** 읽을 때 받아 주는 접미사 (LLM 재추천 등에서 여러 표기가 올 수 있음) */
const SUFFIX_TO_QUALITY: Record<string, ChordQuality> = {
  "": "maj",
  M: "maj",
  maj: "maj",
  m: "min",
  min: "min",
  "-": "min",
  dim: "dim",
  "°": "dim",
  aug: "aug",
  "+": "aug",
  sus2: "sus2",
  sus4: "sus4",
  sus: "sus4",
  "7": "7",
  dom7: "7",
  maj7: "maj7",
  M7: "maj7",
  m7: "m7",
  min7: "m7",
  "-7": "m7",
  m7b5: "m7b5",
  ø: "m7b5",
  dim7: "dim7",
  "°7": "dim7",
};

export type ChordInfo = {
  root: PitchClass;
  quality: ChordQuality;
  /** 슬래시 코드의 베이스음 ("C/E"의 E). 없으면 근음이 베이스 */
  bass?: PitchClass;
};

/** "Am", "Cmaj7", "F#m7b5", "C/E" → ChordInfo. 읽을 수 없으면 null */
export function parseChordSymbol(symbol: string): ChordInfo | null {
  const match = /^([A-G][#b]?)([^/]*)(?:\/([A-G][#b]?))?$/.exec(symbol.trim());
  if (!match) return null;
  const root = parsePitchClass(match[1]);
  const quality = SUFFIX_TO_QUALITY[match[2]];
  if (root === null || quality === undefined) return null;
  if (match[3] === undefined) return { root, quality };
  const bass = parsePitchClass(match[3]);
  if (bass === null) return null;
  return { root, quality, bass };
}

export function chordSymbol(chord: ChordInfo, flats = false): string {
  const base =
    pitchClassName(chord.root, flats) + QUALITY_SUFFIX[chord.quality];
  return chord.bass === undefined || chord.bass === chord.root
    ? base
    : `${base}/${pitchClassName(chord.bass, flats)}`;
}

/** 코드 구성음의 pitch class (근음부터 순서대로) */
export function chordPitchClasses(chord: ChordInfo): PitchClass[] {
  return CHORD_INTERVALS[chord.quality].map((interval) =>
    pitchClass(chord.root + interval),
  );
}
