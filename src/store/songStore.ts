// 곡 상태 전역 store. 모든 화면이 같은 SongState를 읽고 고칩니다.
// song은 DB(projects.song)에 그대로 저장되고, 그 밖의 값(step, saveStatus, dirty)은 화면 전용입니다.
import { create } from "zustand";
import {
  createEmptySong,
  type Accompaniment,
  type Chord,
  type Note,
  type SongState,
  type Style,
  type Track,
  type TrackId,
} from "@/types/song";

export const STUDIO_STEPS = ["record", "refine", "arrange", "mix"] as const;
export type StudioStep = (typeof STUDIO_STEPS)[number];

export type SaveStatus = "idle" | "saving" | "saved" | "error";

/**
 * 진행 바에서 이동할 수 있는 단계. 앞 단계 결과가 있어야 다음 단계가 열립니다.
 * 녹음 전에는 녹음만, 반주까지 만든 뒤에는 네 단계 모두 자유롭게 이동합니다.
 */
export function getAvailableSteps(song: SongState): StudioStep[] {
  const steps: StudioStep[] = ["record"];
  if (song.melody.length === 0) return steps;
  steps.push("refine");
  if (song.chords.length === 0) return steps;
  steps.push("arrange");
  if (!song.accompaniment) return steps;
  steps.push("mix");
  return steps;
}

type SongStore = {
  song: SongState;
  step: StudioStep;
  saveStatus: SaveStatus;
  /** 마지막 저장 이후 song이 바뀌었는지 (자동 저장 판단용) */
  dirty: boolean;

  setTitle: (title: string) => void;
  setBpm: (bpm: number) => void;
  setKey: (key: string) => void;
  setStyle: (style: Style) => void;
  setMelody: (melody: Note[]) => void;
  setChords: (chords: Chord[]) => void;
  setExplanation: (explanation: string) => void;
  setAccompaniment: (accompaniment: Accompaniment) => void;
  updateTrack: (id: TrackId, patch: Partial<Omit<Track, "id">>) => void;
  setRecording: (recording: SongState["recording"]) => void;

  /** 저장된 프로젝트를 불러올 때. dirty를 false로 둡니다. */
  loadSong: (song: SongState) => void;
  /** 새 곡으로 초기화 */
  reset: () => void;

  setStep: (step: StudioStep) => void;
  setSaveStatus: (status: SaveStatus) => void;
  /** 저장이 끝났을 때 호출 */
  markSaved: () => void;
};

const initialState = () => ({
  song: createEmptySong(),
  step: "record" as StudioStep,
  saveStatus: "idle" as SaveStatus,
  dirty: false,
});

export const useSongStore = create<SongStore>()((set) => {
  // song을 바꾸는 액션은 모두 이 함수를 거쳐 dirty를 표시합니다.
  const updateSong = (patch: Partial<SongState>) =>
    set((state) => ({ song: { ...state.song, ...patch }, dirty: true }));

  return {
    ...initialState(),

    setTitle: (title) => updateSong({ title }),
    setBpm: (bpm) => updateSong({ bpm }),
    setKey: (key) => updateSong({ key }),
    setStyle: (style) => updateSong({ style }),
    setMelody: (melody) => updateSong({ melody }),
    setChords: (chords) => updateSong({ chords }),
    setExplanation: (explanation) => updateSong({ explanation }),
    setAccompaniment: (accompaniment) => updateSong({ accompaniment }),
    updateTrack: (id, patch) =>
      set((state) => ({
        song: {
          ...state.song,
          tracks: state.song.tracks.map((track) =>
            track.id === id ? { ...track, ...patch } : track,
          ),
        },
        dirty: true,
      })),
    setRecording: (recording) => updateSong({ recording }),

    loadSong: (song) => set({ ...initialState(), song }),
    reset: () => set(initialState()),

    setStep: (step) => set({ step }),
    setSaveStatus: (saveStatus) => set({ saveStatus }),
    markSaved: () => set({ saveStatus: "saved", dirty: false }),
  };
});
