import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useSongStore } from "@/store/songStore";
import { createEmptySong } from "@/types/song";
import { AUTOSAVE_DELAY, RETRY_DELAY, useProjectSync } from "./useProjectSync";

const db = vi.hoisted(() => ({
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
  localStorage.clear();
  store().reset();
  db.createProject.mockReset().mockResolvedValue("new-id");
  db.saveProject.mockReset().mockResolvedValue(undefined);
  db.loadProject
    .mockReset()
    .mockResolvedValue({ status: "ok", song: createEmptySong() });
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
    // 두 번째 변경은 만든 프로젝트에 저장
    expect(db.saveProject).toHaveBeenLastCalledWith(
      {},
      "new-id",
      expect.objectContaining({ title: "가나다" }),
    );
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
