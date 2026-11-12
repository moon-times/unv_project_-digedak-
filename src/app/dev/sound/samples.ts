// 소리 확인용 샘플 멜로디. 녹음 패널 없이 분석 → 반주 → 재생을 들어 보는 데만 씁니다.
import { analyzeSong } from "@/lib/music";
import { createEmptySong, type Note, type SongState } from "@/types/song";

export type Sample = {
  id: string;
  label: string;
  bpm: number;
  /** [MIDI 번호, 길이(step)]. 쉼표는 pitch를 null로 */
  phrase: [number | null, number][];
};

export const SAMPLES: Sample[] = [
  {
    id: "bright",
    label: "밝은 장조 (C장조 · 112 BPM)",
    bpm: 112,
    phrase: [
      [60, 4],
      [64, 4],
      [67, 4],
      [64, 4],
      [65, 4],
      [69, 4],
      [67, 8],
      [64, 4],
      [67, 4],
      [72, 4],
      [71, 4],
      [69, 4],
      [67, 4],
      [64, 4],
      [60, 4],
      [62, 4],
      [65, 4],
      [69, 4],
      [67, 4],
      [64, 4],
      [62, 4],
      [60, 8],
    ],
  },
  {
    id: "sad",
    label: "느린 단조 (A단조 · 72 BPM)",
    bpm: 72,
    phrase: [
      [69, 4],
      [72, 4],
      [76, 8],
      [74, 4],
      [72, 4],
      [71, 8],
      [69, 4],
      [65, 4],
      [67, 4],
      [64, 4],
      [62, 4],
      [64, 4],
      [69, 8],
    ],
  },
  {
    id: "fast",
    label: "빠르고 촘촘한 장조 (G장조 · 140 BPM)",
    bpm: 140,
    phrase: [
      [67, 2],
      [67, 2],
      [71, 2],
      [74, 2],
      [71, 2],
      [67, 2],
      [69, 4],
      [71, 2],
      [72, 2],
      [74, 4],
      [72, 2],
      [71, 2],
      [69, 4],
      [67, 2],
      [69, 2],
      [71, 2],
      [74, 2],
      [76, 4],
      [74, 4],
      [72, 2],
      [71, 2],
      [69, 2],
      [66, 2],
      [67, 8],
    ],
  },
];

export function sampleMelody(sample: Sample): Note[] {
  const notes: Note[] = [];
  let start = 0;
  for (const [pitch, duration] of sample.phrase) {
    if (pitch !== null) notes.push({ pitch, start, duration, velocity: 0.8 });
    start += duration;
  }
  return notes;
}

/** 샘플 멜로디를 규칙 엔진으로 분석해 키 · 코드 · 추천 장르를 채운 곡. 반주는 반주 패널이 만듭니다. */
export function sampleSong(sample: Sample): SongState {
  const melody = sampleMelody(sample);
  const analysis = analyzeSong(melody, sample.bpm);
  return {
    ...createEmptySong(),
    title: `소리 확인 · ${sample.label}`,
    bpm: sample.bpm,
    melody,
    key: analysis.key,
    chords: analysis.chords,
    style: analysis.recommendedStyle,
    explanation: analysis.explanation,
  };
}
