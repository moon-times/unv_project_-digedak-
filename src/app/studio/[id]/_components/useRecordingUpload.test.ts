import { cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { setLatestRecording } from "@/features/recorder/latestRecording";
import { useSongStore } from "@/store/songStore";
import { createEmptySong } from "@/types/song";
import {
  resetRecordingUpload,
  UPLOAD_RETRY_DELAY,
  useRecordingUpload,
} from "./useRecordingUpload";

const upload = vi.hoisted(() =>
  vi.fn<(client: unknown, projectId: string, blob: Blob) => Promise<string>>(
    async (_client, projectId) => `user-1/${projectId}.webm`,
  ),
);
vi.mock("@/lib/supabase/recordings", () => ({ uploadRecording: upload }));
vi.mock("@/lib/supabase/client", () => ({ createClient: () => ({}) }));

const blob = new Blob(["x"], { type: "audio/webm" });
/** 비동기 업로드가 끝날 때까지 기다립니다 */
const settle = () => vi.advanceTimersByTimeAsync(0);

beforeEach(() => {
  vi.useFakeTimers();
  resetRecordingUpload();
  setLatestRecording(null);
  useSongStore.getState().reset();
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.clearAllMocks();
  vi.restoreAllMocks();
});

describe("녹음 원본 업로드", () => {
  it("저장된 곡에서 녹음하면 바로 올리고 경로를 곡에 남긴다", async () => {
    useSongStore.getState().loadSong(createEmptySong(), "p1");
    renderHook(() => useRecordingUpload(true));

    setLatestRecording(blob);
    await settle();

    expect(upload).toHaveBeenCalledWith(expect.anything(), "p1", blob);
    expect(useSongStore.getState().song.recording).toEqual({
      path: "user-1/p1.webm",
    });
  });

  it("새 곡은 처음 저장되어 id가 생긴 뒤 그 id로 올린다", async () => {
    renderHook(() => useRecordingUpload(true));
    setLatestRecording(blob);
    await settle();
    expect(upload).not.toHaveBeenCalled();

    useSongStore.getState().setProjectId("new-1");
    await settle();
    expect(upload).toHaveBeenCalledWith(expect.anything(), "new-1", blob);
  });

  it("새 곡 녹음 뒤 저장 전에 다른 곡을 열면 버린다 (그 뒤 새 곡을 만들어도 안 붙음)", async () => {
    renderHook(() => useRecordingUpload(true));
    setLatestRecording(blob);
    useSongStore.getState().loadSong(createEmptySong(), "other");
    // 다시 /studio/new로 가서 다른 새 곡이 처음 저장되는 경우
    useSongStore.getState().reset();
    useSongStore.getState().setProjectId("new-2");
    await settle();

    expect(upload).not.toHaveBeenCalled();
    expect(useSongStore.getState().song.recording).toBeUndefined();
  });

  it("게스트 녹음은 기다렸다가 로그인 뒤 다시 열린 스튜디오에서 첫 저장 때 올린다", async () => {
    const guest = renderHook(() => useRecordingUpload(false));
    setLatestRecording(blob);
    await settle();
    guest.unmount(); // /login으로 이동
    expect(upload).not.toHaveBeenCalled();

    renderHook(() => useRecordingUpload(true));
    useSongStore.getState().setProjectId("from-guest");
    await settle();
    expect(upload).toHaveBeenCalledWith(expect.anything(), "from-guest", blob);
  });

  it("실패하면 5초 뒤 한 번 더, 또 실패하면 멈춘다", async () => {
    upload
      .mockRejectedValueOnce(new Error("network"))
      .mockRejectedValueOnce(new Error("network"));
    useSongStore.getState().loadSong(createEmptySong(), "p1");
    renderHook(() => useRecordingUpload(true));

    setLatestRecording(blob);
    await settle();
    expect(upload).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(UPLOAD_RETRY_DELAY);
    expect(upload).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(UPLOAD_RETRY_DELAY * 3);
    expect(upload).toHaveBeenCalledTimes(2);
    expect(useSongStore.getState().song.recording).toBeUndefined();
  });
});
