import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { useSongStore } from "@/store/songStore";
import type { ArrangementSection } from "@/types/song";
import { RetouchBox, waitForSave } from "./RetouchBox";

const section: ArrangementSection = {
  startBar: 0,
  endBar: 2,
  role: "intro",
  energy: 1,
  drums: "none",
  bass: "long",
  keys: "pad",
  guitar: "rest",
  fillAtEnd: false,
  crashAtStart: false,
};
const draft = (summary: string) => ({
  sections: [section],
  endingHit: true,
  summary,
});

const fetchMock = vi.fn();
/** GET은 남은 횟수, POST는 넘긴 응답들을 차례로 */
function server(remaining: number, ...posts: object[]) {
  fetchMock.mockImplementation(async (_url: string, init?: RequestInit) => ({
    ok: true,
    json: async () => (init?.method === "POST" ? posts.shift() : { remaining }),
  }));
}
const arrangement = () => useSongStore.getState().song.arrangement;
const button = (name: string | RegExp) => screen.getByRole("button", { name });

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockReset();
  useSongStore.getState().reset();
  useSongStore.setState({ projectId: "p1" });
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("RetouchBox", () => {
  test("저장 전 곡(게스트)은 버튼 대신 안내", () => {
    useSongStore.setState({ projectId: null });
    render(<RetouchBox />);
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.getByText(/저장된 곡에서 쓸 수 있어요/)).toBeTruthy();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test("버튼 → 계획 적용 · 남은 횟수 · 요약, 전환, 되돌리기", async () => {
    server(
      3,
      { plan: draft("첫 편곡이에요."), remaining: 2 },
      { plan: draft("두 번째예요."), remaining: 1 },
    );
    render(<RetouchBox />);
    await act(async () => {});
    expect(button("AI로 풍성하게 (남은 3회)")).toBeTruthy();

    await act(async () => fireEvent.click(button(/AI로 풍성하게/)));
    expect(arrangement()).toMatchObject({
      summary: "첫 편곡이에요.",
      enabled: true,
    });
    expect(button("AI로 풍성하게 (남은 2회)")).toBeTruthy();
    expect(screen.getByText("첫 편곡이에요.")).toBeTruthy();

    // 전환은 계획을 남긴 채 enabled만 바꿈 (횟수 그대로)
    fireEvent.click(button("원래"));
    expect(arrangement()).toMatchObject({
      summary: "첫 편곡이에요.",
      enabled: false,
    });
    expect(screen.queryByText("첫 편곡이에요.")).toBeNull();
    fireEvent.click(button("AI 편곡"));
    expect(arrangement()!.enabled).toBe(true);

    // 두 번째 리터치 뒤 되돌리기 → 첫 편곡, 한 번 더는 없음 (리터치는 자동 저장이 끝난 뒤 요청)
    act(() => useSongStore.getState().markSaved());
    await act(async () => fireEvent.click(button(/AI로 풍성하게/)));
    expect(arrangement()!.summary).toBe("두 번째예요.");
    fireEvent.click(button("되돌리기"));
    expect(arrangement()!.summary).toBe("첫 편곡이에요.");
    expect(screen.queryByRole("button", { name: "되돌리기" })).toBeNull();
    expect(
      fetchMock.mock.calls.filter(([, init]) => init?.method === "POST"),
    ).toHaveLength(2);
  });

  test("첫 리터치를 되돌리면 계획 없는 원래 반주로", async () => {
    server(3, { plan: draft("편곡"), remaining: 2 });
    render(<RetouchBox />);
    await act(async () => fireEvent.click(button(/AI로 풍성하게/)));
    fireEvent.click(button("되돌리기"));
    expect(arrangement()).toBeUndefined();
  });

  test("실패하면 안내하고 곡은 그대로", async () => {
    server(3, { error: "failed", remaining: 3 });
    render(<RetouchBox />);
    await act(async () => fireEvent.click(button(/AI로 풍성하게/)));
    expect(screen.getByRole("status").textContent).toContain(
      "편곡을 만들지 못했어요",
    );
    expect(arrangement()).toBeUndefined();
  });

  test("다 쓰면 버튼이 꺼지고 안내", async () => {
    server(0);
    render(<RetouchBox />);
    await act(async () => {});
    expect((button(/AI로 풍성하게/) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByRole("status").textContent).toBe(
      "이 곡의 AI 편곡을 다 썼어요.",
    );
  });
});

describe("waitForSave", () => {
  test("저장이 끝나면(dirty false) 풀리고, 끝나지 않으면 시간 초과", async () => {
    vi.useFakeTimers();
    useSongStore.getState().setTitle("바뀜");
    const saved = waitForSave(1000);
    useSongStore.getState().markSaved();
    expect(await saved).toBe(true);

    useSongStore.getState().setTitle("또 바뀜");
    const stuck = waitForSave(1000);
    vi.advanceTimersByTime(1000);
    expect(await stuck).toBe(false);
    vi.useRealTimers();
  });
});
