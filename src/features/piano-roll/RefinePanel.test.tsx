import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { analyzeSong } from "@/lib/music";
import { getAvailableSteps, useSongStore } from "@/store/songStore";
import type { Note } from "@/types/song";
import { RefinePanel } from "./RefinePanel";

const auth = vi.hoisted(() => ({ user: null as object | null }));
vi.mock("@/lib/supabase/useAuthUser", () => ({
  useAuthUser: () => ({ user: auth.user, loading: false }),
}));
const recommender = vi.hoisted(() => ({
  recommendForCurrentSong: vi.fn(),
  undoRecommend: vi.fn(),
}));
vi.mock("@/features/editor/recommend", () => recommender);

// 도-미-솔 위주의 C장조 멜로디 두 마디
const melody: Note[] = [60, 64, 67, 64, 60, 62, 64, 60].map((pitch, i) => ({
  pitch,
  start: i * 4,
  duration: 4,
  velocity: 0.8,
}));

const song = () => useSongStore.getState().song;

beforeEach(() => {
  useSongStore.getState().reset();
  auth.user = null;
  recommender.recommendForCurrentSong.mockReset();
  recommender.undoRecommend.mockReset();
});
afterEach(cleanup);

describe("RefinePanel", () => {
  test("멜로디가 없으면 녹음부터 하라고 한다", () => {
    render(<RefinePanel />);
    expect(screen.getByText(/먼저 ① 녹음에서/)).toBeTruthy();
    expect(song().chords).toEqual([]);
  });

  test("코드가 없으면 열자마자 분석해 키 · 코드 · 설명 · 장르를 넣고 반주 단계를 연다", () => {
    useSongStore.getState().setMelody(melody);
    render(<RefinePanel />);
    const expected = analyzeSong(melody, 100, { stepsPerBar: 16 });
    expect(song().chords).toEqual(expected.chords);
    expect(song().key).toBe(expected.key);
    expect(song().explanation).toBe(expected.explanation);
    expect(song().style).toBe(expected.recommendedStyle);
    expect(getAvailableSteps(song())).toContain("arrange");
    expect(expected.key).toBe("C major");
    expect(screen.getByText("C장조")).toBeTruthy();
    expect(screen.getByText(expected.explanation)).toBeTruthy();
  });

  test("코드가 이미 있으면 열어도 저장할 변경으로 치지 않는다", () => {
    const store = useSongStore.getState();
    store.setMelody(melody);
    store.setChords([{ symbol: "C", start: 0, duration: 32 }]);
    store.markSaved();
    render(<RefinePanel />);
    expect(useSongStore.getState().dirty).toBe(false);
    expect(song().chords).toEqual([{ symbol: "C", start: 0, duration: 32 }]);
  });

  test("다시 분석은 코드를 새로 찾되 고른 장르는 그대로 둔다", () => {
    const store = useSongStore.getState();
    store.setMelody(melody);
    store.setChords([{ symbol: "Am", start: 0, duration: 32 }]);
    store.setStyle("rock");
    render(<RefinePanel />);
    fireEvent.click(screen.getByRole("button", { name: "다시 분석" }));
    expect(song().chords).toEqual(
      analyzeSong(melody, 100, { stepsPerBar: 16 }).chords,
    );
    expect(song().style).toBe("rock");
  });

  test("추천 BPM이 지금과 다르면 적용 버튼으로 바꾼다", () => {
    const store = useSongStore.getState();
    store.setMelody(melody);
    store.setBpm(200);
    render(<RefinePanel />);
    const { bpmSuggestion } = analyzeSong(melody, 200, { stepsPerBar: 16 });
    expect(bpmSuggestion).not.toBe(200);
    fireEvent.click(screen.getByRole("button", { name: "적용" }));
    expect(song().bpm).toBe(bpmSuggestion);
    expect(screen.queryByRole("button", { name: "적용" })).toBeNull();
  });

  test("게스트는 [더 밝게] [더 슬프게]가 꺼져 있고 로그인 안내", () => {
    useSongStore.getState().setMelody(melody);
    render(<RefinePanel />);
    expect(screen.getByRole("button", { name: "더 밝게" })).toHaveProperty(
      "disabled",
      true,
    );
    expect(screen.getByRole("button", { name: "더 슬프게" })).toHaveProperty(
      "disabled",
      true,
    );
    expect(screen.getByRole("status").textContent).toContain("로그인하면");
  });

  test("회원: 누르면 재추천 → 바꾼 수 안내 · 되돌리기, 되돌리면 버튼 사라짐", async () => {
    auth.user = { id: "u1" };
    useSongStore.getState().setMelody(melody);
    const previous = { chords: [], explanation: "전 설명" };
    let finish: (value: unknown) => void = () => {};
    recommender.recommendForCurrentSong.mockReturnValue(
      new Promise((resolve) => (finish = resolve)),
    );
    render(<RefinePanel />);
    fireEvent.click(screen.getByRole("button", { name: "더 슬프게" }));

    expect(recommender.recommendForCurrentSong).toHaveBeenCalledWith("sadder");
    expect(screen.getByRole("status").textContent).toBe(
      "AI가 코드를 고르는 중...",
    );
    expect(screen.getByRole("button", { name: "다시 분석" })).toHaveProperty(
      "disabled",
      true,
    );

    await act(async () => finish({ status: "applied", changed: 2, previous }));
    expect(screen.getByRole("status").textContent).toContain(
      "코드 2개를 바꿨어요",
    );
    fireEvent.click(screen.getByRole("button", { name: "되돌리기" }));
    expect(recommender.undoRecommend).toHaveBeenCalledWith(previous);
    expect(screen.queryByRole("button", { name: "되돌리기" })).toBeNull();
  });

  test("회원: 한도 · 못 찾음 안내", async () => {
    auth.user = { id: "u1" };
    useSongStore.getState().setMelody(melody);
    render(<RefinePanel />);
    recommender.recommendForCurrentSong.mockResolvedValue({
      status: "limited",
    });
    await act(async () =>
      fireEvent.click(screen.getByRole("button", { name: "더 밝게" })),
    );
    expect(screen.getByRole("status").textContent).toContain(
      "오늘 추천을 다 썼어요",
    );
    recommender.recommendForCurrentSong.mockResolvedValue({
      status: "no-change",
    });
    await act(async () =>
      fireEvent.click(screen.getByRole("button", { name: "더 밝게" })),
    );
    expect(screen.getByRole("status").textContent).toContain("찾지 못했어요");
    expect(screen.queryByRole("button", { name: "되돌리기" })).toBeNull();
  });
});
