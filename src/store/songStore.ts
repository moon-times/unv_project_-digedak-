// 곡 상태 전역 store. 모든 화면이 같은 SongState를 읽고 고칩니다.
// song은 DB(projects.song)에 그대로 저장되고, 그 밖의 값(projectId, step, saveStatus, dirty, lastSavedAt)은 화면 전용입니다.
// 아직 프로젝트에 연결되지 않은 곡(게스트 작업)만 브라우저(localStorage)에 보관합니다. docs/specs/02_save-list/design.md §3
import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  createEmptySong,
  type Accompaniment,
  type ArrangementPlan,
  type Chord,
  type Note,
  type SongState,
  type Style,
  type Track,
  type TrackId,
  upgradeSong,
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

/** 곡 제목 최대 길이. DB projects_title_length 제약과 같은 값 */
export const TITLE_MAX_LENGTH = 100;

type SongStore = {
  song: SongState;
  /** 지금 곡이 연결된 프로젝트. null이면 아직 저장 전(게스트이거나 새 곡의 첫 변경 전) */
  projectId: string | null;
  step: StudioStep;
  saveStatus: SaveStatus;
  /** 마지막 저장 이후 song이 바뀌었는지 (자동 저장 판단용) */
  dirty: boolean;
  /** 마지막으로 저장을 마친 시각(ms). 헤더의 "10:42에 자동 저장됨" 표시용 */
  lastSavedAt: number | null;

  setTitle: (title: string) => void;
  setBpm: (bpm: number) => void;
  setKey: (key: string) => void;
  setStyle: (style: Style) => void;
  setMelody: (melody: Note[]) => void;
  setChords: (chords: Chord[]) => void;
  setExplanation: (explanation: string) => void;
  /** undefined면 반주를 지웁니다 (코드가 비었을 때, #27) */
  setAccompaniment: (accompaniment: Accompaniment | undefined) => void;
  setArrangement: (arrangement: ArrangementPlan | undefined) => void;
  updateTrack: (id: TrackId, patch: Partial<Omit<Track, "id">>) => void;
  setRecording: (recording: SongState["recording"]) => void;

  /** 저장된 프로젝트를 불러올 때. 화면 상태를 초기화하고 dirty를 false로 둡니다. */
  loadSong: (song: SongState, projectId: string | null) => void;
  /** 새 곡을 프로젝트로 처음 저장했을 때 */
  setProjectId: (projectId: string) => void;
  /** 새 곡으로 초기화 */
  reset: () => void;

  setStep: (step: StudioStep) => void;
  setSaveStatus: (status: SaveStatus) => void;
  /** 저장이 끝났을 때 호출 */
  markSaved: () => void;
};

const initialState = () => ({
  song: createEmptySong(),
  projectId: null as string | null,
  step: "record" as StudioStep,
  saveStatus: "idle" as SaveStatus,
  dirty: false,
  lastSavedAt: null as number | null,
});

/** localStorage 키. 게스트 작업만 담깁니다. */
export const GUEST_DRAFT_KEY = "digedak-guest-draft";

/**
 * 브라우저에 보관할 내용. 프로젝트에 연결된 곡은 DB에 있으므로 보관하지 않고({}),
 * 연결되는 순간 보관본도 비워집니다.
 */
export function guestDraft(
  state: SongStore,
): Partial<Pick<SongStore, "song" | "dirty">> {
  return state.projectId === null
    ? { song: state.song, dirty: state.dirty }
    : {};
}

export const useSongStore = create<SongStore>()(
  persist(
    (set) => {
      // song을 바꾸는 액션은 모두 이 함수를 거쳐 dirty를 표시합니다.
      const updateSong = (patch: Partial<SongState>) =>
        set((state) => ({ song: { ...state.song, ...patch }, dirty: true }));

      return {
        ...initialState(),

        setTitle: (title) =>
          updateSong({ title: title.slice(0, TITLE_MAX_LENGTH) }),
        setBpm: (bpm) => updateSong({ bpm }),
        setKey: (key) => updateSong({ key }),
        setStyle: (style) => updateSong({ style }),
        setMelody: (melody) => updateSong({ melody }),
        setChords: (chords) => updateSong({ chords }),
        setExplanation: (explanation) => updateSong({ explanation }),
        setAccompaniment: (accompaniment) => updateSong({ accompaniment }),
        setArrangement: (arrangement) => updateSong({ arrangement }),
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

        loadSong: (song, projectId) =>
          set({ ...initialState(), song, projectId }),
        setProjectId: (projectId) => set({ projectId }),
        reset: () => set(initialState()),

        setStep: (step) => set({ step }),
        setSaveStatus: (saveStatus) => set({ saveStatus }),
        markSaved: () =>
          set({ saveStatus: "saved", dirty: false, lastSavedAt: Date.now() }),
      };
    },
    {
      name: GUEST_DRAFT_KEY,
      // 2: 기타 트랙 추가. 그 전에 보관된 게스트 곡은 빠진 트랙을 채워서 불러옵니다.
      version: 2,
      migrate: (persisted) => {
        const draft = persisted as Partial<Pick<SongStore, "song" | "dirty">>;
        return draft.song ? { ...draft, song: upgradeSong(draft.song) } : draft;
      },
      partialize: guestDraft,
      // 서버 렌더링과 첫 화면이 달라지지 않도록, 스튜디오가 뜬 뒤 rehydrate()로 직접 불러옵니다.
      skipHydration: true,
    },
  ),
);
