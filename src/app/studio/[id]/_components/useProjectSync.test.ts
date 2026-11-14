// @vitest-environment jsdom
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useSongStore } from "@/store/songStore";
import { createEmptySong } from "@/types/song";
import {
  AUTOSAVE_DELAY,
  resetProjectSync,
  RETRY_DELAY,
  useProjectSync,
} from "./useProjectSync";

const db = vi.hoisted(() => ({
  PROJECT_CONFLICT: "project-conflict",
  createProject: vi.fn(),
  saveProject: vi.fn(),
  loadProject: vi.fn(),
}));
vi.mock("@/lib/supabase/client", () => ({ createClient: () => ({}) }));
vi.mock("@/lib/supabase/projects", () => db);

const store = () => useSongStore.getState();
/** 타이머와 그 뒤의 Promise까지 흘려보냅니다. */
const wait = (ms: number) => act(() => vi.advanceTimersByTimeAsync(ms));

beforeEach(() => {
  vi.useFakeTimers();
  window.history.replaceState(null, "", "/studio/new");
  localStorage.clear();
  store().reset();
  resetProjectSync();
  db.createProject
    .mockReset()
    .mockResolvedValue({ id: "new-id", updatedAt: "t1" });
  db.saveProject.mockReset().mockResolvedValue("t2");
  db.loadProject.mockReset().mockResolvedValue({
    status: "ok",
    song: createEmptySong(),
    updatedAt: "t0",
  });
});
afterEach(() => {
  // 앞 테스트의 훅이 남아 저장을 계속하지 않도록
  cleanup();
  vi.useRealTimers();
});

describe("useProjectSync", () => {
  it("새 곡은 첫 변경을 여러 번 해도 프로젝트를 한 번만 만들고 주소를 바꾼다", async () => {
    const { result } = renderHook(() => useProjectSync(null, true));
    await wait(0);
    expect(result.current).toBe("ready");

    act(() => {
      store().setTitle("가");
      store().setTitle("가나");
    });
    await wait(AUTOSAVE_DELAY);
    act(() => store().setTitle("가나다"));
    await wait(AUTOSAVE_DELAY);

    expect(db.createProject).toHaveBeenCalledTimes(1);
    expect(store().projectId).toBe("new-id");
    expect(window.location.pathname).toBe("/studio/new-id");
    // 두 번째 변경은 만든 프로젝트에, 만들 때 받은 시각을 붙여 저장
    expect(db.saveProject).toHaveBeenLastCalledWith(
      {},
      "new-id",
      expect.objectContaining({ title: "가나다" }),
      "t1",
    );
  });

  it("새 곡을 저장하기 전에 떠나면 저장은 보내되 주소는 바꾸지 않는다", async () => {
    const { unmount } = renderHook(() => useProjectSync(null, true));
    await wait(0);
    act(() => store().setTitle("급히 나감"));
    // 2초가 지나기 전에 내 프로젝트로 이동
    window.history.pushState(null, "", "/projects");
    unmount();
    await wait(0);
    expect(db.createProject).toHaveBeenCalledTimes(1);
    expect(store().projectId).toBe("new-id");
    expect(window.location.pathname).toBe("/projects");
  });

  it("2초 안에 이어진 변경은 한 번만 저장한다", async () => {
    renderHook(() => useProjectSync("p1", true));
    await wait(0);
    act(() => store().setTitle("하나"));
    await wait(1000);
    act(() => store().setTitle("둘"));
    await wait(1000);
    expect(db.saveProject).not.toHaveBeenCalled();
    await wait(AUTOSAVE_DELAY);
    expect(db.saveProject).toHaveBeenCalledTimes(1);
    expect(db.saveProject.mock.calls[0][2].title).toBe("둘");
    expect(store()).toMatchObject({ dirty: false, saveStatus: "saved" });
  });

  it("저장하는 동안 바뀐 내용도 끝난 뒤 이어서 저장한다", async () => {
    let finish!: () => void;
    db.saveProject.mockImplementationOnce(
      () => new Promise<void>((resolve) => (finish = resolve)),
    );
    renderHook(() => useProjectSync("p1", true));
    await wait(0);
    act(() => store().setTitle("첫 저장"));
    await wait(AUTOSAVE_DELAY);
    act(() => store().setTitle("저장 중 변경"));
    await act(async () => finish());
    expect(store().dirty).toBe(true);
    await wait(AUTOSAVE_DELAY);
    expect(db.saveProject).toHaveBeenCalledTimes(2);
    expect(db.saveProject.mock.calls[1][2].title).toBe("저장 중 변경");
    expect(store().dirty).toBe(false);
  });

  it("실패하면 실패로 표시하고 5초 뒤 한 번 다시 시도한다", async () => {
    db.saveProject.mockRejectedValueOnce(new Error("network"));
    renderHook(() => useProjectSync("p1", true));
    await wait(0);
    act(() => store().setTitle("곡"));
    await wait(AUTOSAVE_DELAY);
    expect(store().saveStatus).toBe("error");
    await wait(RETRY_DELAY);
    expect(db.saveProject).toHaveBeenCalledTimes(2);
    expect(store().saveStatus).toBe("saved");
  });

  it("두 번 다 실패해 예약이 없어도, 떠날 때와 네트워크가 돌아올 때 저장한다", async () => {
    db.saveProject.mockRejectedValue(new Error("network"));
    const { unmount } = renderHook(() => useProjectSync("p1", true));
    await wait(0);
    act(() => store().setTitle("곡"));
    await wait(AUTOSAVE_DELAY + RETRY_DELAY);
    expect(db.saveProject).toHaveBeenCalledTimes(2);
    await wait(RETRY_DELAY * 4);
    expect(db.saveProject).toHaveBeenCalledTimes(2);

    db.saveProject.mockRejectedValueOnce(new Error("network"));
    act(() => void window.dispatchEvent(new Event("online")));
    await wait(0);
    expect(db.saveProject).toHaveBeenCalledTimes(3);

    db.saveProject.mockResolvedValue("t2");
    unmount();
    await wait(0);
    expect(db.saveProject).toHaveBeenCalledTimes(4);
    expect(store().dirty).toBe(false);
  });

  it("불러온 뒤 다른 탭이 저장했으면 덮어쓰지 않고 멈춘다", async () => {
    db.saveProject.mockRejectedValue(new Error("project-conflict"));
    const { unmount } = renderHook(() => useProjectSync("p1", true));
    await wait(0);
    act(() => store().setTitle("이 탭"));
    await wait(AUTOSAVE_DELAY);
    // 불러올 때 본 시각과 같을 때만 저장하도록 넘깁니다.
    expect(db.saveProject).toHaveBeenCalledWith(
      {},
      "p1",
      expect.anything(),
      "t0",
    );
    expect(store().saveStatus).toBe("conflict");

    act(() => store().setTitle("더 고침"));
    await wait(AUTOSAVE_DELAY + RETRY_DELAY);
    unmount();
    await wait(0);
    expect(db.saveProject).toHaveBeenCalledTimes(1);
  });

  it("저장에 실패한 뒤에는 시각을 비교하지 않는다 (응답만 잃은 내 저장을 충돌로 보지 않게)", async () => {
    db.saveProject.mockRejectedValueOnce(new Error("network"));
    renderHook(() => useProjectSync("p1", true));
    await wait(0);
    act(() => store().setTitle("곡"));
    await wait(AUTOSAVE_DELAY + RETRY_DELAY);
    expect(db.saveProject.mock.calls[0][3]).toBe("t0");
    expect(db.saveProject.mock.calls[1][3]).toBeUndefined();
    expect(store().saveStatus).toBe("saved");
  });

  it("형식이 깨진 곡과 게스트 작업은 저장하지 않는다", async () => {
    db.loadProject.mockResolvedValue({ status: "invalid" });
    const { result } = renderHook(() => useProjectSync("broken", true));
    await wait(0);
    expect(result.current).toBe("invalid");
    act(() => store().setTitle("덮어쓰기 시도"));
    await wait(AUTOSAVE_DELAY * 2);
    expect(db.saveProject).not.toHaveBeenCalled();

    renderHook(() => useProjectSync(null, false));
    await wait(0);
    act(() => store().setTitle("게스트 곡"));
    await wait(AUTOSAVE_DELAY * 2);
    expect(db.createProject).not.toHaveBeenCalled();
  });

  it("없는 프로젝트는 not-found", async () => {
    db.loadProject.mockResolvedValue({ status: "not-found" });
    const { result } = renderHook(() => useProjectSync("missing", true));
    expect(result.current).toBe("loading");
    await wait(0);
    expect(result.current).toBe("not-found");
  });
});
