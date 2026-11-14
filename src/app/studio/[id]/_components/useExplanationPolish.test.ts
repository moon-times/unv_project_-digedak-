// @vitest-environment jsdom
import { cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useSongStore } from "@/store/songStore";
import { createEmptySong } from "@/types/song";
import {
  resetExplanationPolish,
  useExplanationPolish,
} from "./useExplanationPolish";

const fetchMock = vi.fn();
const respond = (json: object) =>
  fetchMock.mockResolvedValueOnce({ ok: true, json: async () => json });

const melody = [{ pitch: 60, start: 0, duration: 4, velocity: 0.8 }];
/** 보정 패널의 분석처럼: 같은 멜로디 위에서 키 · 코드 · 설명을 바꿈 */
function analyze(explanation: string) {
  const store = useSongStore.getState();
  store.setKey("C major");
  store.setChords([{ symbol: "C", start: 0, duration: 16 }]);
  store.setExplanation(explanation);
}

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  resetExplanationPolish();
  useSongStore.getState().loadSong({ ...createEmptySong(), melody }, "p1");
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  fetchMock.mockReset();
});

describe("AI 설명 다듬기", () => {
  it("분석 직후 요청하고, 다듬은 문장으로 바꿈 (그 문장으로는 다시 요청 안 함)", async () => {
    respond({ explanation: "C장조로 밝아요.", polished: true });
    renderHook(() => useExplanationPolish(true));
    analyze("규칙 엔진 설명");

    await waitFor(() =>
      expect(useSongStore.getState().song.explanation).toBe("C장조로 밝아요."),
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.analysis).toMatchObject({
      key: "C major",
      explanation: "규칙 엔진 설명",
    });
  });

  it("게스트는 요청하지 않음", async () => {
    renderHook(() => useExplanationPolish(false));
    analyze("규칙 엔진 설명");
    await Promise.resolve();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("응답 전에 다시 분석하면 이전 응답은 버림", async () => {
    let first: (value: unknown) => void = () => {};
    fetchMock.mockReturnValueOnce(new Promise((resolve) => (first = resolve)));
    respond({ explanation: "두 번째 다듬기", polished: true });
    renderHook(() => useExplanationPolish(true));

    analyze("첫 설명");
    analyze("두 번째 설명");
    await waitFor(() =>
      expect(useSongStore.getState().song.explanation).toBe("두 번째 다듬기"),
    );
    first({
      ok: true,
      json: async () => ({ explanation: "늦은 첫 다듬기", polished: true }),
    });
    await Promise.resolve();
    expect(useSongStore.getState().song.explanation).toBe("두 번째 다듬기");
  });

  it("저장된 곡을 열 때는 설명이 바뀌어도 요청 안 함", async () => {
    renderHook(() => useExplanationPolish(true));
    useSongStore
      .getState()
      .loadSong(
        { ...createEmptySong(), melody, explanation: "저장된 설명" },
        "p2",
      );
    await Promise.resolve();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("다듬지 못했으면(polished false · 한도) 규칙 엔진 설명 그대로", async () => {
    respond({ explanation: "규칙 엔진 설명", polished: false, limited: true });
    renderHook(() => useExplanationPolish(true));
    analyze("규칙 엔진 설명");
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    await Promise.resolve();
    expect(useSongStore.getState().song.explanation).toBe("규칙 엔진 설명");
  });
});
