// 반주 템플릿 엔진: 코드 진행과 장르로 드럼·베이스·건반 음표를 만듭니다.
// 같은 입력이면 항상 같은 결과가 나오므로(무작위 없음) 장르를 바꿀 때마다 다시 불러도 됩니다.
import { parseChordSymbol, type ChordInfo } from "@/lib/music";
import type {
  Accompaniment,
  ArrangementPlan,
  Chord,
  Note,
  Style,
} from "@/types/song";
import {
  DRUM,
  ENERGY_GAIN,
  endingPattern,
  patternFor,
  STYLE_PATTERNS,
  type GuitarHit,
} from "./patterns";
import { bassPitch, chooseVoicing, guitarVoicing, voiceAt } from "./voicing";

const DEFAULT_STEPS_PER_BAR = 16;
/** 이 BPM 이상이면 하이햇 간격을 두 배로 벌려 너무 바쁘지 않게 합니다. */
const FAST_BPM = 140;

export type ArrangeOptions = {
  /**
   * 한 마디의 step 수. 4/4박자는 16.
   * 곡 박자표를 따르려면 `stepsPerBar(song.timeSignature)` (`@/lib/transport`)를 넘깁니다.
   */
  stepsPerBar?: number;
  /** AI 리터치 편곡 계획. 없거나 enabled가 false면 장르 패턴 그대로 (명세 08) */
  plan?: ArrangementPlan;
};

/** 필인이 차지하는 마디 끝 길이(step) = 1박 */
const FILL_STEPS = 4;
const FILL_TOMS = [DRUM.tomHighest, DRUM.tomHigh, DRUM.tomMid, DRUM.tomLow];

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

/** 스트로크 종류에 맞춰 기타 코드 모양에서 칠 줄을 고릅니다. */
function guitarStrings(voicing: number[], strum: GuitarHit["strum"]): number[] {
  if (strum === "down") return voicing;
  if (strum === "up") return voicing.slice(-3);
  if (strum === "power") return voicing.slice(0, 3);
  return strum.map((index) => voicing[Math.min(index, voicing.length - 1)]);
}

const byTime = (a: Note, b: Note) => a.start - b.start || a.pitch - b.pitch;

export function generateAccompaniment(
  chords: Chord[],
  style: Style,
  bpm: number,
  { stepsPerBar = DEFAULT_STEPS_PER_BAR, plan }: ArrangeOptions = {},
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
  const stylePattern = STYLE_PATTERNS[style];
  const sections = plan?.enabled ? plan.sections : undefined;
  const parsed = parseChords(chords);

  const drums: Note[] = [];
  const bass: Note[] = [];
  const keys: Note[] = [];
  const guitar: Note[] = [];
  const inBar = (step: number) => step < barSteps;
  let voicing: number[] | null = null;
  let voicedChord: ParsedChord | undefined;

  for (let bar = 0; bar < barCount; bar++) {
    const barStart = bar * barSteps;
    const barEnd = Math.min(barStart + barSteps, songEnd);
    const fits = (start: number, duration: number) =>
      Math.max(1, Math.min(duration, barEnd - start));

    // 편곡 계획: 이 마디가 속한 구간의 설정으로 패턴 · 세기 · 크래시 · 필인을 정합니다.
    const section = sections?.find((s) => s.startBar <= bar && bar < s.endBar);
    const ending = !!sections && !!plan?.endingHit && bar === barCount - 1;
    const pattern = ending
      ? endingPattern(stylePattern, barSteps)
      : section
        ? patternFor(stylePattern, section, barSteps)
        : stylePattern;
    const gain = section && !ending ? ENERGY_GAIN[section.energy - 1] : 1;
    const vel = (velocity: number) => Math.min(1, velocity * gain);
    const fillFrom =
      section?.fillAtEnd &&
      !ending &&
      bar === Math.min(section.endBar, barCount) - 1
        ? barSteps - FILL_STEPS
        : barSteps;
    const hatInterval =
      bpm >= FAST_BPM ? pattern.hatInterval * 2 : pattern.hatInterval;

    // 드럼
    for (const { step, pitch, velocity } of pattern.drums) {
      const start = barStart + step;
      if (step < fillFrom && inBar(step) && start < barEnd)
        drums.push({ pitch, start, duration: 1, velocity: vel(velocity) });
    }
    for (
      let step = 0;
      hatInterval > 0 && step < fillFrom && barStart + step < barEnd;
      step += hatInterval
    ) {
      const [strong, weak] = pattern.hatVelocity;
      drums.push({
        pitch: DRUM.closedHat,
        start: barStart + step,
        duration: 1,
        velocity: vel(step % 4 === 0 ? strong : weak),
      });
    }
    // 필인: 마디 끝 1박을 탐 16분음표로, 높은 탐에서 낮은 탐으로 점점 세게
    for (let step = fillFrom, i = 0; step < barSteps; step++, i++) {
      if (barStart + step < barEnd)
        drums.push({
          pitch: FILL_TOMS[i % FILL_TOMS.length],
          start: barStart + step,
          duration: 1,
          velocity: vel(0.6 + 0.1 * i),
        });
    }
    const crashBar = sections
      ? ending || (!!section?.crashAtStart && bar === section.startBar)
      : stylePattern.crashEveryBars === 0
        ? bar === 0
        : bar % stylePattern.crashEveryBars === 0;
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
        velocity: vel(velocity),
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
        keys.push({ pitch, start, duration: length, velocity: vel(velocity) });
    }

    // 기타: 코드 모양에서 스트로크 종류에 맞는 줄만 칩니다.
    for (const { step, duration, strum, velocity } of pattern.guitar) {
      const start = barStart + step;
      const chord = chordAt(parsed, start);
      if (!inBar(step) || start >= barEnd || !chord) continue;
      const length = fits(start, Math.min(duration, chord.end - start));
      for (const pitch of guitarStrings(guitarVoicing(chord.info), strum))
        guitar.push({
          pitch,
          start,
          duration: length,
          velocity: vel(velocity),
        });
    }
  }

  return {
    drums: drums.sort(byTime),
    bass: bass.sort(byTime),
    keys: keys.sort(byTime),
    guitar: guitar.sort(byTime),
  };
}
