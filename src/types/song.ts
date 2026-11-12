// 세 역할이 함께 쓰는 곡 데이터 타입. 기준: docs/01_project_overview.md §5
// 이 파일을 바꾸는 PR은 설명에 변경 사항을 적고 팀원 전체를 리뷰어로 지정합니다.
// 런타임 검증용 Zod 스키마는 src/lib/schemas.ts에 있고, 이 타입과 어긋나면 타입 검사에서 걸립니다.

/** 위치·길이 단위. 1 step = 16분음표 하나 */
export type Step = number;

export type Note = {
  pitch: number; // MIDI 번호 (60 = C4)
  start: Step;
  duration: Step;
  velocity: number; // 0 ~ 1
};

export type Chord = {
  symbol: string; // "Cmaj7", "Am" 등
  start: Step;
  duration: Step;
};

export const TRACK_IDS = ["melody", "drums", "bass", "keys", "guitar"] as const;
export type TrackId = (typeof TRACK_IDS)[number];

export type Track = {
  id: TrackId;
  instrument: string;
  volume: number; // dB
  muted: boolean;
  solo: boolean;
  effects?: { reverb?: number; eqLow?: number; eqHigh?: number };
};

export const STYLES = ["pop", "ballad", "rock"] as const;
export type Style = (typeof STYLES)[number];

export type Accompaniment = {
  drums: Note[];
  bass: Note[];
  keys: Note[];
  guitar: Note[]; // 기타 트랙을 넣기 전에 저장된 곡은 불러올 때 빈 배열로 채웁니다.
};

export type SongState = {
  version: 1;
  title: string;
  bpm: number;
  key: string; // "C major"
  timeSignature: [number, number];
  style: Style;
  melody: Note[];
  chords: Chord[];
  explanation?: string; // 규칙 엔진 기본 설명 또는 LLM이 다듬은 설명
  accompaniment?: Accompaniment; // 반주 엔진 결과 (타임라인 반주 줄 표시용)
  tracks: Track[];
  recording?: { path: string; trimStart?: number; trimEnd?: number };
};

/** 규칙 엔진(analyzeSong)과 /api/analyze가 함께 쓰는 분석 결과 형식 */
export type AnalysisResult = {
  key: string;
  chords: Chord[];
  recommendedStyle: Style;
  bpmSuggestion: number;
  explanation: string;
};

// 트랙별 기본 악기 이름. 이름의 뜻은 src/features/player/instruments.ts의 createInstrument를 봅니다.
const DEFAULT_INSTRUMENTS: Record<TrackId, string> = {
  melody: "flute",
  drums: "drums",
  bass: "bass",
  keys: "piano",
  guitar: "acoustic_guitar_steel",
};

export function defaultTrack(id: TrackId): Track {
  return {
    id,
    instrument: DEFAULT_INSTRUMENTS[id],
    volume: 0,
    muted: false,
    solo: false,
  };
}

/**
 * 모든 트랙이 TRACK_IDS 순서로 하나씩 있도록 맞춥니다.
 * 트랙이 늘어나기 전에 저장된 곡을 불러올 때, 빠진 트랙은 기본값으로 채웁니다.
 */
export function withAllTracks(tracks: Track[]): Track[] {
  return TRACK_IDS.map(
    (id) => tracks.find((track) => track.id === id) ?? defaultTrack(id),
  );
}

/** 예전 형식으로 저장된 곡(기타 트랙 이전)을 지금 형식으로 맞춥니다. */
export function upgradeSong(song: SongState): SongState {
  const accompaniment = song.accompaniment && {
    ...song.accompaniment,
    guitar: song.accompaniment.guitar ?? [],
  };
  return {
    ...song,
    tracks: withAllTracks(song.tracks),
    ...(accompaniment && { accompaniment }),
  };
}

export function createEmptySong(): SongState {
  return {
    version: 1,
    title: "제목 없는 곡",
    bpm: 100,
    key: "C major",
    timeSignature: [4, 4],
    style: "pop",
    melody: [],
    chords: [],
    tracks: TRACK_IDS.map(defaultTrack),
  };
}
