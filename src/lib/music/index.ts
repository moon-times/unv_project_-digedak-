// 음악 엔진 공개 API. 다른 폴더에서는 "@/lib/music"으로 가져다 씁니다.
export { analyzeSong, type AnalyzeOptions } from "./analyze";
export {
  assignChords,
  diatonicCandidates,
  scoreChordForNotes,
  type ChordAssignment,
  type ChordCandidate,
} from "./chords";
export { buildExplanation, koreanKeyName } from "./explain";
export { detectKey, pitchClassHistogram, type KeyDetection } from "./key";
export { recommendStyle, suggestBpm, STYLE_BPM_RANGE } from "./style";
export {
  CHORD_INTERVALS,
  chordPitchClasses,
  chordSymbol,
  keyName,
  parseChordSymbol,
  parseKey,
  parsePitchClass,
  pitchClass,
  pitchClassName,
  scalePitchClasses,
  usesFlats,
  type ChordInfo,
  type ChordQuality,
  type Key,
  type Mode,
  type PitchClass,
} from "./theory";
