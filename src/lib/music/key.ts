// 키 판별: Krumhansl–Schmuckler 알고리즘.
// 음별로 울린 길이(step)를 더한 분포를 24개 키(장조 12 + 단조 12)의 표준 분포와
// 피어슨 상관계수로 비교해 가장 비슷한 키를 고릅니다.
import type { Note } from "@/types/song";
import { pitchClass, type Key, type Mode } from "./theory";

// Krumhansl–Kessler 프로파일. 인덱스 0이 으뜸음
const MAJOR_PROFILE = [
  6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88,
];
const MINOR_PROFILE = [
  6.33, 2.68, 3.52, 5.38, 2.6, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17,
];

/** pitch class별 총 길이(step). 길게 부른 음일수록 키 판단에 크게 반영됩니다. */
export function pitchClassHistogram(melody: Note[]): number[] {
  const histogram = new Array<number>(12).fill(0);
  for (const note of melody) histogram[pitchClass(note.pitch)] += note.duration;
  return histogram;
}

function correlation(a: number[], b: number[]): number {
  const n = a.length;
  const meanA = a.reduce((sum, x) => sum + x, 0) / n;
  const meanB = b.reduce((sum, x) => sum + x, 0) / n;
  let cov = 0;
  let varA = 0;
  let varB = 0;
  for (let i = 0; i < n; i++) {
    const da = a[i] - meanA;
    const db = b[i] - meanB;
    cov += da * db;
    varA += da * da;
    varB += db * db;
  }
  if (varA === 0 || varB === 0) return 0;
  return cov / Math.sqrt(varA * varB);
}

export type KeyDetection = {
  key: Key;
  /** 가장 잘 맞는 키의 상관계수 (-1 ~ 1). 높을수록 확신이 큼 */
  correlation: number;
  /** 두 번째로 잘 맞는 키 (나란한조 혼동 등을 설명할 때 사용) */
  runnerUp: Key;
  histogram: number[];
};

const DEFAULT_KEY: Key = { tonic: 0, mode: "major" };

export function detectKey(melody: Note[]): KeyDetection {
  const histogram = pitchClassHistogram(melody);
  const scores: { key: Key; r: number }[] = [];
  for (const mode of ["major", "minor"] as Mode[]) {
    const profile = mode === "major" ? MAJOR_PROFILE : MINOR_PROFILE;
    for (let tonic = 0; tonic < 12; tonic++) {
      // 으뜸음이 tonic인 키의 프로파일: pitch class pc의 값은 profile[pc - tonic]
      const rotated = histogram.map((_, pc) => profile[pitchClass(pc - tonic)]);
      scores.push({ key: { tonic, mode }, r: correlation(histogram, rotated) });
    }
  }
  // 동점이면 먼저 넣은 키(장조, 낮은 음)가 앞에 오도록 안정 정렬
  scores.sort((a, b) => b.r - a.r);

  if (scores[0].r <= 0) {
    return {
      key: DEFAULT_KEY,
      correlation: 0,
      runnerUp: DEFAULT_KEY,
      histogram,
    };
  }
  return {
    key: scores[0].key,
    correlation: scores[0].r,
    runnerUp: scores[1].key,
    histogram,
  };
}
