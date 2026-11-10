"use client";
// 재생기를 React 화면에 연결하는 훅.
import { useEffect, useSyncExternalStore } from "react";
import { useSongStore } from "@/store/songStore";
import { INITIAL_PLAYER_STATE, player, type PlayerState } from "./player";

const serverSnapshot = () => INITIAL_PLAYER_STATE;

/** 재생 상태와 위치. 재생 중에는 화면 프레임마다 바뀝니다. */
export function usePlayerState(): PlayerState {
  return useSyncExternalStore(
    player.subscribe,
    player.getState,
    serverSnapshot,
  );
}

/** 재생 위치(step)만 필요할 때. 타임라인의 재생선 표시용 */
export function usePlaybackStep(): number {
  return usePlayerState().step;
}

/**
 * store의 곡이 바뀌면 재생기에 반영합니다. 스튜디오 화면에서 한 번만 부릅니다.
 * 제목·저장 상태처럼 소리와 상관없는 변경은 무시합니다.
 */
export function useSyncPlayerWithSong(): void {
  useEffect(() => {
    void player.load(useSongStore.getState().song);
    return useSongStore.subscribe((state, previous) => {
      const song = state.song;
      const before = previous.song;
      if (
        song.melody !== before.melody ||
        song.accompaniment !== before.accompaniment ||
        song.tracks !== before.tracks ||
        song.bpm !== before.bpm ||
        song.timeSignature !== before.timeSignature
      ) {
        void player.load(song);
      }
    });
  }, []);
}
