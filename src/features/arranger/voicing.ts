// 코드를 실제 음높이(MIDI)로 펼치는 규칙.
import {
  CHORD_INTERVALS,
  chordPitchClasses,
  pitchClass,
  type ChordInfo,
} from "@/lib/music";
import type { BassTone } from "./patterns";

/** 베이스 근음 범위: E1(28) ~ D#2(39). 5도·옥타브는 이 위로 올라갑니다. */
const BASS_LOWEST = 28;

export function bassPitch(chord: ChordInfo, tone: BassTone): number {
  // 슬래시 코드("C/E")는 지정된 베이스음을 근음 자리에 씁니다.
  const bass = chord.bass ?? chord.root;
  const low = BASS_LOWEST + pitchClass(bass - BASS_LOWEST);
  if (tone === "octave") return low + 12;
  // 5도는 코드의 실제 구성음(dim은 b5, aug는 #5)을 베이스음 위에서 찾습니다. C/E면 E 위의 G.
  const fifth = chord.root + CHORD_INTERVALS[chord.quality][2];
  if (tone === "fifth") return low + pitchClass(fifth - low);
  return low;
}

/** 건반 보이싱의 가장 낮은 음이 들어갈 범위: G3(55) ~ F#4(66) */
const KEYS_LOWEST = 55;
/** 첫 코드는 평균 음높이가 이 근처(E4)인 보이싱을 고릅니다. */
const KEYS_CENTER = 64;

/** 전위(근음·1전위·2전위…)마다 아래에서 위로 쌓은 보이싱 후보 */
export function voicingCandidates(chord: ChordInfo): number[][] {
  const pcs = chordPitchClasses(chord);
  return pcs.map((_, inversion) => {
    const order = [...pcs.slice(inversion), ...pcs.slice(0, inversion)];
    const voicing: number[] = [];
    for (const pc of order) {
      const floor =
        voicing.length === 0 ? KEYS_LOWEST : voicing[voicing.length - 1] + 1;
      voicing.push(floor + pitchClass(pc - floor));
    }
    return voicing;
  });
}

const mean = (values: number[]) =>
  values.reduce((sum, v) => sum + v, 0) / values.length;

/** 두 보이싱 사이 움직임의 크기. 음 개수가 다르면 평균 높이 차이로 봅니다. */
function movement(from: number[], to: number[]): number {
  if (from.length !== to.length)
    return Math.abs(mean(from) - mean(to)) * to.length;
  return from.reduce((sum, pitch, i) => sum + Math.abs(pitch - to[i]), 0);
}

/**
 * 앞 코드에서 가장 적게 움직이는 보이싱을 고릅니다 (성부 진행).
 * 앞 코드가 없으면 가운데 음역에 가장 가까운 보이싱을 고릅니다.
 */
export function chooseVoicing(
  chord: ChordInfo,
  previous: number[] | null,
): number[] {
  const candidates = voicingCandidates(chord);
  const cost = (voicing: number[]) =>
    previous
      ? movement(previous, voicing)
      : Math.abs(mean(voicing) - KEYS_CENTER);
  return candidates.reduce((best, voicing) =>
    cost(voicing) < cost(best) ? voicing : best,
  );
}

/** 보이싱의 index번째 음. 보이싱 길이를 넘으면 옥타브 위로 이어집니다 (아르페지오용). */
export function voiceAt(voicing: number[], index: number): number {
  const octave = Math.floor(index / voicing.length);
  return voicing[index % voicing.length] + octave * 12;
}

/** 기타 코드의 가장 낮은 줄(근음)이 들어갈 범위: E2(40) ~ D#3(51) */
const GUITAR_LOWEST = 40;

/**
 * 기타 코드 모양(6줄 바레 코드처럼): 근음 · 5도 · 옥타브 근음 · 3도 · 5도 · (7도 또는 옥타브).
 * 슬래시 코드는 지정된 베이스음을 가장 낮은 줄에 둡니다.
 * 0~2번은 파워코드(근음 · 5도 · 옥타브)로도 씁니다.
 */
export function guitarVoicing(chord: ChordInfo): number[] {
  const [, third, fifth, seventh] = CHORD_INTERVALS[chord.quality];
  const root = GUITAR_LOWEST + pitchClass(chord.root - GUITAR_LOWEST);
  const low =
    chord.bass === undefined
      ? root
      : GUITAR_LOWEST + pitchClass(chord.bass - GUITAR_LOWEST);
  return [
    low,
    root + fifth,
    root + 12,
    root + 12 + third,
    root + 12 + fifth,
    seventh === undefined ? root + 24 : root + 12 + seventh,
  ].sort((a, b) => a - b);
}
