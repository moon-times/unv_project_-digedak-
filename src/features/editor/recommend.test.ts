// @vitest-environment jsdom
import { renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  resetExplanationPolish,
  useExplanationPolish,
} from "@/app/studio/[id]/_components/useExplanationPolish";
import { useSongStore } from "@/store/songStore";
import { recommendForCurrentSong, undoRecommend } from "./recommend";

const fetchMock = vi.fn();
const reply = (body: object) => ({ ok: true, json: async () => body });
const oldChords = [
  { symbol: "C", start: 0, duration: 16 },
  { symbol: "G", start: 16, duration: 16 },
];
const newChords = [oldChords[0], { symbol: "Ab", start: 16, duration: 16 }];
const song = () => useSongStore.getState().song;

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockReset();
  resetExplanationPolish();
  const store = useSongStore.getState();
  store.reset();
  store.setMelody([{ pitch: 60, start: 0, duration: 4, velocity: 0.8 }]);
  store.setChords(oldChords);
  store.setExplanation("원래 설명");
});
afterEach(() => vi.unstubAllGlobals());

describe("recommendForCurrentSong (명세 11)", () => {
  it("바뀐 코드를 넣고, 새 설명은 다듬기가 다시 부르지 않으며, 되돌리면 원래대로", async () => {
    renderHook(() => useExplanationPolish(true));
    fetchMock.mockResolvedValue(
      reply({
        recommended: true,
        changed: 1,
        chords: newChords,
        explanation: "Ab으로 바꿨어요.",
      }),
    );
    const outcome = await recommendForCurrentSong("sadder");

    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toMatchObject({
      request: "sadder",
      melody: song().melody,
      analysis: { chords: oldChords, explanation: "원래 설명" },
    });
    expect(outcome).toEqual({
      status: "applied",
      changed: 1,
      previous: { chords: oldChords, explanation: "원래 설명" },
    });
    expect(song().chords).toEqual(newChords);
    expect(song().explanation).toBe("Ab으로 바꿨어요.");

    if (outcome.status === "applied") undoRecommend(outcome.previous);
    expect(song().chords).toEqual(oldChords);
    expect(song().explanation).toBe("원래 설명");
    // 재추천 요청 한 번뿐: 바뀐 설명 · 되돌린 설명 모두 다듬기를 다시 부르지 않음
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("다 걸러졌거나 한도 · 키 없음 · 실패면 곡을 그대로 둔다", async () => {
    for (const [body, status] of [
      [
        { recommended: true, changed: 0, chords: oldChords, explanation: "x" },
        "no-change",
      ],
      [{ recommended: false, limited: true }, "limited"],
      [{ recommended: false, unavailable: true }, "unavailable"],
      [{ recommended: false }, "failed"],
    ] as const) {
      fetchMock.mockResolvedValue(reply(body));
      expect((await recommendForCurrentSong("brighter")).status).toBe(status);
      expect(song().chords).toEqual(oldChords);
    }
    fetchMock.mockRejectedValue(new Error("offline"));
    expect((await recommendForCurrentSong("brighter")).status).toBe("failed");
  });

  it("기다리는 사이 다시 분석했으면 결과를 버린다", async () => {
    let respond: (value: unknown) => void = () => {};
    fetchMock.mockReturnValue(new Promise((resolve) => (respond = resolve)));
    const pending = recommendForCurrentSong("brighter");
    useSongStore
      .getState()
      .setChords([{ symbol: "Am", start: 0, duration: 32 }]);
    respond(
      reply({
        recommended: true,
        changed: 1,
        chords: newChords,
        explanation: "x",
      }),
    );
    expect((await pending).status).toBe("failed");
    expect(song().chords[0].symbol).toBe("Am");
  });
});
