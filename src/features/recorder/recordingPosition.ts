"use client";
// 녹음 중 지금 위치(step). 녹음 패널이 쓰고, 스튜디오 타임라인이 주황 재생선으로 그립니다.
// 녹음 중이 아니면 null. 프레임마다 바뀌는 값이라 store(SongState)에 넣지 않습니다.
import { useSyncExternalStore } from "react";
import type { Step } from "@/types/song";

/** 재생선을 이 칸(step) 단위로만 옮깁니다. 프레임(20ms)마다 타임라인을 다시 그리지 않게 */
const RESOLUTION = 0.5;

let position: Step | null = null;
const listeners = new Set<() => void>();

export function setRecordingPosition(step: Step | null) {
  const next =
    step === null
      ? null
      : Math.floor(Math.max(0, step) / RESOLUTION) * RESOLUTION;
  if (next === position) return;
  position = next;
  listeners.forEach((listener) => listener());
}

export function getRecordingPosition() {
  return position;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** 녹음 중 위치(step). 녹음 중이 아니면 null */
export function useRecordingPosition(): Step | null {
  return useSyncExternalStore(subscribe, getRecordingPosition, () => null);
}
