"use client";
// 코드 진행 · 장르 · 빠르기 · 박자 · 편곡 계획이 바뀌면 반주를 다시 만들어 store에 넣습니다.
import { useEffect } from "react";
import { stepsPerBar } from "@/lib/transport";
import { useSongStore } from "@/store/songStore";
import type { Accompaniment, SongState } from "@/types/song";
import { generateAccompaniment } from "./generate";

/** 곡의 코드 · 장르 · 빠르기 · 박자 · 편곡 계획으로 만든 반주 */
export function accompanimentFor(song: SongState): Accompaniment {
  return generateAccompaniment(song.chords, song.style, song.bpm, {
    stepsPerBar: stepsPerBar(song.timeSignature),
    plan: song.arrangement,
  });
}

function sameAccompaniment(a: Accompaniment | undefined, b: Accompaniment) {
  return a !== undefined && JSON.stringify(a) === JSON.stringify(b);
}

/**
 * 반주를 곡과 맞춥니다.
 * - create: true(반주 패널): 반주가 없으면 처음 만듭니다. 반주를 처음 만드는 건 패널을 열 때뿐이라 믹싱 단계가 저절로 열리지 않습니다.
 * - create: false(스튜디오, 항상 떠 있음): 반주가 있을 때만 다시 만듭니다. 패널이 닫혀 있어도 코드를 바꾸면 반주가 따라옵니다(#27).
 * - 코드가 비면(다시 녹음) 있던 반주를 지웁니다.
 * - 결과가 지금 반주와 같으면 store를 건드리지 않아 자동 저장이 돌지 않습니다. 둘이 함께 떠 있어도 한 번만 바뀝니다.
 */
export function useAccompanimentSync({ create }: { create: boolean }): void {
  const chords = useSongStore((s) => s.song.chords);
  const style = useSongStore((s) => s.song.style);
  const bpm = useSongStore((s) => s.song.bpm);
  const timeSignature = useSongStore((s) => s.song.timeSignature);
  const arrangement = useSongStore((s) => s.song.arrangement);

  useEffect(() => {
    const { song, setAccompaniment } = useSongStore.getState();
    if (song.chords.length === 0) {
      if (song.accompaniment) setAccompaniment(undefined);
      return;
    }
    if (!create && !song.accompaniment) return;
    const next = accompanimentFor(song);
    if (!sameAccompaniment(song.accompaniment, next)) setAccompaniment(next);
  }, [create, chords, style, bpm, timeSignature, arrangement]);
}
