// 반주 템플릿 엔진: 코드 진행과 장르로 드럼·베이스·건반 음표를 만듭니다.
// 같은 입력이면 항상 같은 결과가 나오므로(무작위 없음) 장르를 바꿀 때마다 다시 불러도 됩니다.
import { parseChordSymbol, type ChordInfo } from "@/lib/music";
import type { Accompaniment, Chord, Note, Style } from "@/types/song";
import { DRUM, STYLE_PATTERNS } from "./patterns";
import { bassPitch, chooseVoicing, voiceAt } from "./voicing";

const DEFAULT_STEPS_PER_BAR = 16;
/** 이 BPM 이상이면 하이햇 간격을 두 배로 벌려 너무 바쁘지 않게 합니다. */
const FAST_BPM = 140;

export type ArrangeOptions = {
  /**
   * 한 마디의 step 수. 4/4박자는 16.
   * 곡 박자표를 따르려면 `stepsPerBar(song.timeSignature)` (`@/lib/transport`)를 넘깁니다.
   */
  stepsPerBar?: number;
};

type ParsedChord = { info: ChordInfo; start: number; end: number };

function parseChords(chords: Chord[]): ParsedChord[] {
  const parsed: ParsedChord[] = [];
  for (const chord of chords) {
    const info = parseChordSymbol(chord.symbol);
    // 읽을 수 없는 코드 구간은 베이스·건반을 쉽니다 (드럼은 계속).
    if (info)
      parsed.push({
        info,
        start: chord.start,
        end: chord.start + chord.duration,
      });
  }
  return parsed.sort((a, b) => a.start - b.start);
}

function chordAt(chords: ParsedChord[], step: number): ParsedChord | undefined {
  return chords.find((chord) => chord.start <= step && step < chord.end);
}

const byTime = (a: Note, b: Note) => a.start - b.start || a.pitch - b.pitch;

export function generateAccompaniment(
  chords: Chord[],
  style: Style,
  bpm: number,
  { stepsPerBar = DEFAULT_STEPS_PER_BAR }: ArrangeOptions = {},
): Accompaniment {
  const barSteps =
    Number.isFinite(stepsPerBar) && stepsPerBar > 0
      ? stepsPerBar
      : DEFAULT_STEPS_PER_BAR;
  const songEnd = Math.max(
    0,
    ...chords.map((chord) => chord.start + chord.duration),
  );
  const barCount = Math.ceil(songEnd / barSteps);
  const pattern = STYLE_PATTERNS[style];
  const parsed = parseChords(chords);

  const drums: Note[] = [];
  const bass: Note[] = [];
  const keys: Note[] = [];
  const hatInterval =
    bpm >= FAST_BPM ? pattern.hatInterval * 2 : pattern.hatInterval;
  const inBar = (step: number) => step < barSteps;
  let voicing: number[] | null = null;
  let voicedChord: ParsedChord | undefined;

  for (let bar = 0; bar < barCount; bar++) {
    const barStart = bar * barSteps;
    const barEnd = Math.min(barStart + barSteps, songEnd);
    const fits = (start: number, duration: number) =>
      Math.max(1, Math.min(duration, barEnd - start));

    // 드럼
    for (const { step, pitch, velocity } of pattern.drums) {
      const start = barStart + step;
      if (inBar(step) && start < barEnd)
        drums.push({ pitch, start, duration: 1, velocity });
    }
    for (
      let step = 0;
      inBar(step) && barStart + step < barEnd;
      step += hatInterval
    ) {
      const [strong, weak] = pattern.hatVelocity;
      drums.push({
        pitch: DRUM.closedHat,
        start: barStart + step,
        duration: 1,
        velocity: step % 4 === 0 ? strong : weak,
      });
    }
    const crashBar =
      pattern.crashEveryBars === 0
        ? bar === 0
        : bar % pattern.crashEveryBars === 0;
    if (crashBar)
      drums.push({
        pitch: DRUM.crash,
        start: barStart,
        duration: 1,
        velocity: 0.8,
      });

    // 베이스: 이벤트 시점의 코드를 따르고, 코드가 끝나면 음도 끊습니다.
    for (const { step, duration, tone, velocity } of pattern.bass) {
      const start = barStart + step;
      const chord = chordAt(parsed, start);
      if (!inBar(step) || start >= barEnd || !chord) continue;
      bass.push({
        pitch: bassPitch(chord.info, tone),
        start,
        duration: fits(start, Math.min(duration, chord.end - start)),
        velocity,
      });
    }

    // 건반: 코드가 바뀔 때마다 앞 보이싱에서 가장 가깝게 움직이는 보이싱을 고릅니다.
    for (const { step, duration, voices, velocity } of pattern.keys) {
      const start = barStart + step;
      const chord = chordAt(parsed, start);
      if (!inBar(step) || start >= barEnd || !chord) continue;
      if (chord !== voicedChord) {
        voicing = chooseVoicing(chord.info, voicing);
        voicedChord = chord;
      }
      const length = fits(start, Math.min(duration, chord.end - start));
      const pitches =
        voices === "chord" ? voicing! : voices.map((i) => voiceAt(voicing!, i));
      for (const pitch of pitches)
        keys.push({ pitch, start, duration: length, velocity });
    }
  }

  return {
    drums: drums.sort(byTime),
    bass: bass.sort(byTime),
    keys: keys.sort(byTime),
  };
}
