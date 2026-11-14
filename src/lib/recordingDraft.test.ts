// jsdom에는 IndexedDB가 없어 "못 쓰는 환경"만 확인합니다. 실제 저장 · 복원은 브라우저에서 확인 (명세 06 design §5).
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  clearRecordingDraft,
  loadRecordingDraft,
  saveRecordingDraft,
} from "./recordingDraft";

afterEach(() => vi.unstubAllGlobals());

describe("녹음 원본 보관 (IndexedDB 없음)", () => {
  it("없으면 조용히 넘어가고 읽기는 null", async () => {
    vi.stubGlobal("indexedDB", undefined);
    await expect(saveRecordingDraft(new Blob(["x"]))).resolves.toBeUndefined();
    await expect(loadRecordingDraft()).resolves.toBeNull();
    await expect(clearRecordingDraft()).resolves.toBeUndefined();
  });

  it("열다가 오류가 나도 던지지 않음", async () => {
    vi.stubGlobal("indexedDB", {
      open: () => {
        throw new Error("SecurityError");
      },
    });
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    await expect(loadRecordingDraft()).resolves.toBeNull();
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});
