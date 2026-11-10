// 코드 진행 배정: 마디마다 후보 코드에 점수를 매기고(멜로디 음과 구성음이 얼마나 맞는지),
// 코드 전환이 자연스러운지까지 더해 Viterbi로 전체 진행을 고릅니다.
import type { Chord, Note } from "@/types/song";
import {
  chordPitchClasses,
  chordSymbol,
  pitchClass,
  scalePitchClasses,
  usesFlats,
  type ChordInfo,
  type ChordQuality,
  type Key,
  type PitchClass,
} from "./theory";

export type ChordCandidate = ChordInfo & {
  /** 음계 안에서의 도수 (0 = 으뜸음, 4 = 딸림음) */
  degree: number;
  roman: string;
  symbol: string;
};

// [도수, 화음 종류, 로마 숫자]. 장조는 vii°, 단조는 ii°를 뺍니다(팝 반주에서 거의 안 씀).
// 단조의 V는 화성단음계의 장3화음이라 이끈음(예: A단조의 G#)이 들어갑니다.
const MAJOR_CANDIDATES: [number, ChordQuality, string][] = [
  [0, "maj", "I"],
  [1, "min", "ii"],
  [2, "min", "iii"],
  [3, "maj", "IV"],
  [4, "maj", "V"],
  [5, "min", "vi"],
];
const MINOR_CANDIDATES: [number, ChordQuality, string][] = [
  [0, "min", "i"],
  [2, "maj", "III"],
  [3, "min", "iv"],
  [4, "maj", "V"],
  [5, "maj", "VI"],
  [6, "maj", "VII"],
];

export function diatonicCandidates(key: Key): ChordCandidate[] {
  const scale = scalePitchClasses(key);
  const flats = usesFlats(key);
  const table = key.mode === "major" ? MAJOR_CANDIDATES : MINOR_CANDIDATES;
  return table.map(([degree, quality, roman]) => {
    const info: ChordInfo = { root: scale[degree], quality };
    return { ...info, degree, roman, symbol: chordSymbol(info, flats) };
  });
}

/**
 * 한 구간(start ~ end step)의 멜로디가 코드와 얼마나 맞는지. 대략 -1 ~ 1.25.
 * 구성음이면 +, 음계음이지만 구성음이 아니면 약한 -, 음계 밖의 음이면 강한 -.
 * 울린 길이로 가중하고, 강박(1·3박)에 걸린 음과 근음은 더 크게 봅니다.
 * LLM이 재추천한 코드를 검사할 때도 이 함수를 씁니다.
 */
export function scoreChordForNotes(
  melody: Note[],
  chordPcs: PitchClass[],
  scalePcs: PitchClass[],
  start: number,
  end: number,
): number {
  const strongBeat = (end - start) / 2;
  let score = 0;
  let total = 0;
  for (const note of melody) {
    const noteEnd = note.start + note.duration;
    const overlap = Math.min(end, noteEnd) - Math.max(start, note.start);
    if (overlap <= 0) continue;
    const position = Math.max(start, note.start) - start;
    const weight = overlap * (position % strongBeat === 0 ? 1.5 : 1);
    const pc = pitchClass(note.pitch);
    total += weight;
    if (chordPcs.includes(pc))
      score += pc === chordPcs[0] ? weight * 1.25 : weight;
    else if (scalePcs.includes(pc)) score -= weight * 0.5;
    else score -= weight;
  }
  return total === 0 ? 0 : score / total;
}

// 도수 사이 전환 점수. 없는 조합은 0. 기능 화성(T → S → D → T) 흐름을 따릅니다.
const TRANSITIONS: Record<string, number> = {
  "4-0": 1.0, // V → I (정격 종지)
  "1-4": 0.9, // ii → V
  "3-4": 0.8, // IV → V
  "6-0": 0.6, // VII → i (단조)
  "3-0": 0.5, // IV → I (변격 종지)
  "4-5": 0.5, // V → vi (거짓 종지)
  "5-3": 0.6, // vi → IV
  "5-1": 0.6, // vi → ii
  "2-5": 0.5, // iii → vi
  "0-3": 0.4,
  "0-4": 0.4,
  "0-5": 0.4,
  "0-1": 0.3,
  "0-2": 0.3,
  "5-6": 0.4, // VI → VII (단조)
  "2-3": 0.3, // III → iv (단조)
  "4-3": -0.4, // V → IV (딸림에서 버금딸림으로 되돌아감)
  "4-1": -0.4,
};

function transitionScore(from: number, to: number): number {
  if (from === to) return 0.1; // 같은 코드 유지는 약간 허용
  return TRANSITIONS[`${from}-${to}`] ?? 0;
}

const TRANSITION_WEIGHT = 0.35;
const TONIC_START_BONUS = 0.3;
const TONIC_END_BONUS = 0.3;
const DOMINANT_END_BONUS = 0.1; // 반종지

export type ChordAssignment = {
  chords: Chord[];
  /** 마디별 로마 숫자 (설명 문장용) */
  romans: string[];
};

/** 마디마다 코드 하나를 배정합니다. 멜로디가 비어 있으면 빈 진행을 돌려줍니다. */
export function assignChords(
  melody: Note[],
  key: Key,
  stepsPerBar = 16,
): ChordAssignment {
  const songEnd = Math.max(
    0,
    ...melody.map((note) => note.start + note.duration),
  );
  const barCount = Math.ceil(songEnd / stepsPerBar);
  if (barCount === 0) return { chords: [], romans: [] };

  const candidates = diatonicCandidates(key);
  const scale = scalePitchClasses(key);
  const candidatePcs = candidates.map(chordPitchClasses);

  // emission[bar][k]: bar 마디에서 k번 후보의 멜로디 적합도
  const emission = Array.from({ length: barCount }, (_, bar) =>
    candidatePcs.map((pcs) =>
      scoreChordForNotes(
        melody,
        pcs,
        scale,
        bar * stepsPerBar,
        (bar + 1) * stepsPerBar,
      ),
    ),
  );

  // Viterbi: best[bar][k] = bar 마디가 k번 코드로 끝나는 진행 중 최고 점수
  const best: number[][] = [];
  const back: number[][] = [];
  best.push(
    candidates.map(
      (c, k) => emission[0][k] + (c.degree === 0 ? TONIC_START_BONUS : 0),
    ),
  );
  back.push(candidates.map(() => -1));
  for (let bar = 1; bar < barCount; bar++) {
    const row: number[] = [];
    const backRow: number[] = [];
    candidates.forEach((to, k) => {
      let bestScore = -Infinity;
      let bestPrev = 0;
      candidates.forEach((from, j) => {
        const s =
          best[bar - 1][j] +
          TRANSITION_WEIGHT * transitionScore(from.degree, to.degree);
        if (s > bestScore) {
          bestScore = s;
          bestPrev = j;
        }
      });
      row.push(bestScore + emission[bar][k]);
      backRow.push(bestPrev);
    });
    best.push(row);
    back.push(backRow);
  }

  const last = best[barCount - 1].map((score, k) => {
    const degree = candidates[k].degree;
    if (degree === 0) return score + TONIC_END_BONUS;
    if (degree === 4) return score + DOMINANT_END_BONUS;
    return score;
  });
  let k = last.indexOf(Math.max(...last));
  const path: number[] = [];
  for (let bar = barCount - 1; bar >= 0; bar--) {
    path.unshift(k);
    k = back[bar][k];
  }

  return {
    chords: path.map((index, bar) => ({
      symbol: candidates[index].symbol,
      start: bar * stepsPerBar,
      duration: stepsPerBar,
    })),
    romans: path.map((index) => candidates[index].roman),
  };
}
