"use client";
// 코드 진행 · 장르 · 빠르기가 바뀌면 반주를 다시 만들어 store에 넣습니다.
import { useEffect } from "react";
import { stepsPerBar } from "@/lib/transport";
import { useSongStore } from "@/store/songStore";
import type { Accompaniment, SongState } from "@/types/song";
import { generateAccompaniment } from "./generate";

/** 곡의 코드 · 장르 · 빠르기 · 박자로 만든 반주 */
export function accompanimentFor(song: SongState): Accompaniment {
  return generateAccompaniment(song.chords, song.style, song.bpm, {
    stepsPerBar: stepsPerBar(song.timeSignature),
  });
}

function sameAccompaniment(a: Accompaniment | undefined, b: Accompaniment) {
  return a !== undefined && JSON.stringify(a) === JSON.stringify(b);
}

/**
 * 반주 패널이 떠 있는 동안 반주를 곡과 맞춥니다.
 * - 패널을 처음 열 때 반주가 없거나, 보정 단계에서 코드가 바뀌어 반주가 낡았으면 새로 만듭니다.
 * - 결과가 지금 반주와 같으면 store를 건드리지 않아 자동 저장이 돌지 않습니다.
 */
export function useAccompanimentSync(): void {
  const chords = useSongStore((s) => s.song.chords);
  const style = useSongStore((s) => s.song.style);
  const bpm = useSongStore((s) => s.song.bpm);
  const timeSignature = useSongStore((s) => s.song.timeSignature);

  useEffect(() => {
    const { song, setAccompaniment } = useSongStore.getState();
    // 코드가 없으면 반주도 만들 수 없습니다 (반주 단계는 코드가 있어야 열립니다).
    if (song.chords.length === 0) return;
    const next = accompanimentFor(song);
    if (!sameAccompaniment(song.accompaniment, next)) setAccompaniment(next);
  }, [chords, style, bpm, timeSignature]);
}
