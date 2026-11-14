// 보정 단계에서 코드 줄의 코드를 직접 바꿀 때 쓰는 순수 함수들 (작업 7 선택 기능 "코드 수정").
// 코드의 위치 · 길이는 그대로 두고 기호만 바꿉니다. 마디 나누기는 분석(analyzeSong)이 정합니다.
import {
  chordPitchClasses,
  chordSymbol,
  diatonicCandidates,
  parseChordSymbol,
  parseKey,
  scalePitchClasses,
  scoreChordForNotes,
} from "@/lib/music";
import type { Chord, Note } from "@/types/song";

/** 이 점수 이상이면 그 구간 멜로디와 "잘 어울려요" 표시. scoreChordForNotes는 대략 -1 ~ 1.25 */
export const GOOD_FIT_SCORE = 0.5;

export type ChordChoice = {
  symbol: string;
  /** 키 안에서의 로마 숫자 (I, vi, V …) */
  roman: string;
  /** 그 코드 구간 멜로디와 어울리는 정도. 구간에 음이 없으면 null */
  score: number | null;
};

/**
 * 직접 입력한 코드 기호를 곡의 표기로 맞춥니다. 읽을 수 없으면 null.
 * "am" → "Am", "Amin7" → "Am7", "Bb" → "Bb". 샵/플랫은 쓴 대로 둡니다.
 */
export function normalizeChordSymbol(input: string): string | null {
  const trimmed = input.trim();
  // 근음만 소문자로 쓴 경우("am", "f#m")를 받아 줍니다. 나머지(m, M7 등)는 대소문자 뜻이 달라 그대로 둡니다.
  const fixed = trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
  const info = parseChordSymbol(fixed);
  if (!info) return null;
  // 플랫으로 썼으면 플랫으로 다시 씁니다 ("m7b5"의 b는 음 이름이 아니라 [A-G] 뒤만 봅니다).
  return chordSymbol(info, /[A-G]b/.test(fixed));
}

/** 이 코드 구간에 넣어 볼 만한 키 안의 코드들과, 구간 멜로디와 어울리는 정도 */
export function chordChoices(
  keyName: string,
  melody: Note[],
  chord: Chord,
): ChordChoice[] {
  const key = parseKey(keyName);
  if (!key) return [];
  const scale = scalePitchClasses(key);
  const end = chord.start + chord.duration;
  const hasNotes = melody.some(
    (note) => note.start < end && note.start + note.duration > chord.start,
  );
  return diatonicCandidates(key).map((candidate) => ({
    symbol: candidate.symbol,
    roman: candidate.roman,
    score: hasNotes
      ? scoreChordForNotes(
          melody,
          chordPitchClasses(candidate),
          scale,
          chord.start,
          end,
        )
      : null,
  }));
}

/** index번 코드의 기호만 바꾼 새 코드 목록. 같으면 원래 배열을 그대로 돌려줍니다 */
export function replaceChord(
  chords: Chord[],
  index: number,
  symbol: string,
): Chord[] {
  const target = chords[index];
  if (!target || target.symbol === symbol) return chords;
  return chords.map((chord, i) => (i === index ? { ...chord, symbol } : chord));
}
