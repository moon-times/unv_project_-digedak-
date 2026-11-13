import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { useSongStore } from "@/store/songStore";
import type { Note } from "@/types/song";
import { STEP_WIDTH } from "./layout";
import { noteIndexAt, velocityAt } from "./MelodyEditor";
import { Timeline } from "./Timeline";

// 재생기는 가짜로 (실제 소리는 브라우저에서 확인)
const playback = vi.hoisted(() => {
  const listeners = new Set<() => void>();
  const state = { status: "ready", step: 0 };
  return {
    state,
    listeners,
    set(status: string) {
      state.status = status;
      listeners.forEach((l) => l());
    },
    init: vi.fn(async () => {}),
    play: vi.fn(async () => {}),
    pause: vi.fn(),
    applyMix: vi.fn(),
  };
});
vi.mock("@/features/player", () => ({
  INITIAL_PLAYER_STATE: { status: "idle", step: 0 },
  player: {
    init: playback.init,
    play: async () => {
      await playback.play();
      playback.set("playing");
    },
    pause: () => {
      playback.pause();
      playback.set("paused");
    },
    applyMix: playback.applyMix,
    subscribe: (l: () => void) => {
      playback.listeners.add(l);
      return () => playback.listeners.delete(l);
    },
    getState: () => playback.state,
  },
}));
// mock 뒤에 가져와야 가짜 재생기를 씁니다.
const { MelodyOnlyButton, melodyOnlyMix } = await import("./MelodyOnlyButton");

const n = (
  pitch: number,
  start: number,
  duration = 4,
  velocity = 0.8,
): Note => ({
  pitch,
  start,
  duration,
  velocity,
});
// 박에서 조금씩 어긋난 멜로디
const melody: Note[] = [n(60, 1, 3), n(62, 5, 3), n(64, 9, 4)];

const song = () => useSongStore.getState().song;
const button = (name: string | RegExp) => screen.getByRole("button", { name });

beforeEach(() => {
  useSongStore.getState().reset();
  useSongStore.getState().setMelody(melody);
  playback.state.status = "ready";
  vi.clearAllMocks();
});
afterEach(cleanup);

describe("스냅 · 박자 맞추기", () => {
  test("기본 스냅은 1/16이고 1박을 고르면 바뀐다", () => {
    render(<Timeline editable />);
    expect(
      screen.getByRole("radio", { name: "1/16" }).getAttribute("aria-checked"),
    ).toBe("true");
    fireEvent.click(screen.getByRole("radio", { name: "1박" }));
    expect(
      screen.getByRole("radio", { name: "1박" }).getAttribute("aria-checked"),
    ).toBe("true");
  });

  test("1박 스냅으로 박자 맞추기 → 모든 음이 박에 붙는다", () => {
    render(<Timeline editable />);
    fireEvent.click(screen.getByRole("radio", { name: "1박" }));
    fireEvent.click(button("박자 맞추기"));
    expect(song().melody.map((note) => note.start)).toEqual([0, 4, 8]);
    expect(song().melody.every((note) => note.duration % 4 === 0)).toBe(true);
  });

  test("이미 맞으면 바꾸지 않는다 (되돌리기 기록도 안 쌓임)", () => {
    useSongStore.getState().setMelody([n(60, 0), n(62, 4)]);
    useSongStore.getState().markSaved();
    render(<Timeline editable />);
    fireEvent.click(button("박자 맞추기"));
    expect(useSongStore.getState().dirty).toBe(false);
    expect(button("되돌리기")).toHaveProperty("disabled", true);
  });

  test("스냅 단위로 방향키 이동", () => {
    render(<Timeline editable />);
    fireEvent.click(screen.getByRole("radio", { name: "1박" }));
    const first = screen.getAllByRole("button", { name: /마디/ })[0];
    fireEvent.focus(first);
    fireEvent.keyDown(first, { key: "ArrowRight" });
    // 1 + 4 = 5 → 1박 칸(4)에 맞춰 4. 다음 음(5)과 겹치지 않게 1칸으로 잘림
    expect(song().melody[0]).toEqual(n(60, 4, 1));
  });
});

test("다른 단계로 갔다 돌아오면 선택한 음이 비워져 있다", () => {
  const { rerender } = render(<Timeline editable />);
  const third = screen.getAllByRole("button", { name: /마디/ })[2];
  fireEvent.focus(third);
  expect(third.getAttribute("aria-pressed")).toBe("true");
  rerender(<Timeline />);
  rerender(<Timeline editable />);
  expect(
    screen
      .getAllByRole("button", { name: /마디/ })
      .some((note) => note.getAttribute("aria-pressed") === "true"),
  ).toBe(false);
  expect(screen.getByText(/두 번 누르면/)).toBeTruthy();
});

describe("되돌리기 · 다시하기", () => {
  test("편집 → 되돌리기 → 다시하기", () => {
    render(<Timeline editable />);
    expect(button("되돌리기")).toHaveProperty("disabled", true);
    const first = screen.getAllByRole("button", { name: /마디/ })[0];
    fireEvent.focus(first);
    fireEvent.keyDown(first, { key: "Delete" });
    expect(song().melody).toHaveLength(2);

    fireEvent.click(button("되돌리기"));
    expect(song().melody).toEqual(melody);
    expect(button("다시하기")).toHaveProperty("disabled", false);

    fireEvent.click(button("다시하기"));
    expect(song().melody).toHaveLength(2);
  });

  test("Ctrl+Z · Ctrl+Shift+Z", () => {
    render(<Timeline editable />);
    fireEvent.click(button("박자 맞추기"));
    const aligned = song().melody;
    fireEvent.keyDown(window, { key: "z", ctrlKey: true });
    expect(song().melody).toEqual(melody);
    fireEvent.keyDown(window, { key: "Z", ctrlKey: true, shiftKey: true });
    expect(song().melody).toEqual(aligned);
  });

  test("편집기 밖에서 멜로디가 바뀌면(다시 녹음) 그 전 기록은 쓰지 않는다", () => {
    render(<Timeline editable />);
    fireEvent.click(button("박자 맞추기"));
    act(() => useSongStore.getState().setMelody([n(70, 0)]));
    expect(button("되돌리기")).toHaveProperty("disabled", true);
    fireEvent.keyDown(window, { key: "z", ctrlKey: true });
    expect(song().melody).toEqual([n(70, 0)]);
  });

  test("글자 입력 칸에서는 Ctrl+Z를 가로채지 않는다", () => {
    render(
      <>
        <input aria-label="제목" />
        <Timeline editable />
      </>,
    );
    fireEvent.click(screen.getByRole("radio", { name: "1박" }));
    fireEvent.click(button("박자 맞추기"));
    fireEvent.keyDown(screen.getByRole("textbox"), { key: "z", ctrlKey: true });
    expect(song().melody).not.toEqual(melody);
  });

  test("보기 전용에서는 단축키가 동작하지 않는다", () => {
    render(<Timeline />);
    fireEvent.keyDown(window, { key: "z", ctrlKey: true });
    expect(song().melody).toEqual(melody);
  });
});

describe("세기 줄", () => {
  test("velocityAt: 위쪽 1, 아래쪽 최소 0.05", () => {
    expect(velocityAt(0, 40)).toBe(1);
    expect(velocityAt(20, 40)).toBe(0.5);
    expect(velocityAt(40, 40)).toBe(0.05);
    expect(velocityAt(-10, 40)).toBe(1);
  });

  test("noteIndexAt: step이 걸친 음", () => {
    expect(noteIndexAt(melody, 2)).toBe(0);
    expect(noteIndexAt(melody, 0)).toBeNull();
    expect(noteIndexAt(melody, 12)).toBe(2);
  });

  test("막대를 끌면 놓을 때 그 음의 세기만 바뀐다", () => {
    render(<Timeline editable />);
    const lane = document.querySelector("[data-velocity-lane]")!;
    // 두 번째 음(5 ~ 8 step) 위에서 줄 높이(40px)의 1/4 지점 → 0.75
    fireEvent.pointerDown(lane, {
      button: 0,
      pointerId: 1,
      clientX: STEP_WIDTH * 6,
      clientY: 30,
    });
    fireEvent.pointerMove(lane, { pointerId: 1, clientY: 10 });
    expect(song().melody[1].velocity).toBe(0.8);
    fireEvent.pointerUp(lane, { pointerId: 1 });
    expect(song().melody.map((note) => note.velocity)).toEqual([
      0.8, 0.75, 0.8,
    ]);
  });

  test("음이 없는 곳을 누르면 아무것도 바뀌지 않는다", () => {
    useSongStore.getState().markSaved();
    render(<Timeline editable />);
    const lane = document.querySelector("[data-velocity-lane]")!;
    fireEvent.pointerDown(lane, {
      button: 0,
      pointerId: 1,
      clientX: 2,
      clientY: 0,
    });
    fireEvent.pointerUp(lane, { pointerId: 1 });
    expect(useSongStore.getState().dirty).toBe(false);
  });
});

describe("멜로디만 듣기", () => {
  test("melodyOnlyMix: 멜로디만 솔로, 뮤트돼 있어도 들리게", () => {
    const tracks = song().tracks.map((t) =>
      t.id === "melody" ? { ...t, muted: true } : { ...t, solo: true },
    );
    const mix = melodyOnlyMix(tracks);
    expect(mix.filter((t) => t.solo).map((t) => t.id)).toEqual(["melody"]);
    expect(mix.find((t) => t.id === "melody")!.muted).toBe(false);
  });

  test("누르면 멜로디만 들리게 재생하고, 멈추면 원래 믹스로 · store는 그대로", async () => {
    useSongStore.getState().markSaved();
    render(<MelodyOnlyButton />);
    await act(async () => fireEvent.click(button("멜로디만 듣기")));
    expect(playback.init).toHaveBeenCalled();
    expect(playback.applyMix).toHaveBeenLastCalledWith(
      melodyOnlyMix(song().tracks),
    );
    expect(playback.play).toHaveBeenCalled();
    expect(button("멈추기").getAttribute("aria-pressed")).toBe("true");

    await act(async () => fireEvent.click(button("멈추기")));
    expect(playback.pause).toHaveBeenCalled();
    expect(playback.applyMix).toHaveBeenLastCalledWith(song().tracks);
    expect(button("멜로디만 듣기")).toBeTruthy();
    expect(useSongStore.getState().dirty).toBe(false);
  });

  test("듣는 중에 음을 고쳐도(재생기가 원래 믹스로 돌린 뒤) 멜로디만 들리게 다시 건다", async () => {
    // 스튜디오의 useSyncPlayerWithSong처럼 먼저 구독해, 곡이 바뀌면 원래 믹스로 돌리는 재생기
    const unsubscribe = useSongStore.subscribe((state) =>
      playback.applyMix(state.song.tracks),
    );
    render(<MelodyOnlyButton />);
    await act(async () => fireEvent.click(button("멜로디만 듣기")));
    act(() =>
      useSongStore
        .getState()
        .setMelody(song().melody.map((note) => ({ ...note, velocity: 0.5 }))),
    );
    expect(playback.applyMix).toHaveBeenLastCalledWith(
      melodyOnlyMix(song().tracks),
    );
    unsubscribe();
  });

  test("멈춘 뒤에 음을 고치면 원래 믹스 그대로", async () => {
    render(<MelodyOnlyButton />);
    await act(async () => fireEvent.click(button("멜로디만 듣기")));
    await act(async () => fireEvent.click(button("멈추기")));
    playback.applyMix.mockClear();
    act(() => useSongStore.getState().setMelody([n(70, 0)]));
    expect(playback.applyMix).not.toHaveBeenCalled();
  });

  test("재생 바에서 정지해도(곡 끝 포함) 원래 믹스로 돌아간다", async () => {
    render(<MelodyOnlyButton />);
    await act(async () => fireEvent.click(button("멜로디만 듣기")));
    act(() => playback.set("ready"));
    expect(playback.applyMix).toHaveBeenLastCalledWith(song().tracks);
  });

  test("멜로디가 없으면 꺼져 있다", () => {
    useSongStore.getState().setMelody([]);
    render(<MelodyOnlyButton />);
    expect(button("멜로디만 듣기")).toHaveProperty("disabled", true);
  });
});
