"use client";
// 피아노롤 편집 되돌리기 · 다시하기. 멜로디 기록만 따로 쌓습니다(store 전체 기록은 하지 않음).
// 편집기 밖에서 멜로디가 바뀌면(다시 녹음, 프로젝트 불러오기) 그 전 기록은 쓰지 않습니다.
import { useState } from "react";
import { useSongStore } from "@/store/songStore";
import type { Note } from "@/types/song";

/** 되돌리기 기록 최대 개수 */
export const HISTORY_LIMIT = 50;

type History = {
  undo: Note[][];
  redo: Note[][];
  /** 마지막으로 이 기록이 넣은 멜로디. store 값이 이것과 다르면 밖에서 바뀐 것입니다 */
  last: Note[] | null;
};

const EMPTY: History = { undo: [], redo: [], last: null };

export function useMelodyHistory() {
  const melody = useSongStore((s) => s.song.melody);
  const [history, setHistory] = useState<History>(EMPTY);
  // 밖에서 바뀐 뒤에는 남은 기록을 버린 것으로 봅니다.
  const fresh = history.last === null || history.last === melody;
  const live = fresh ? history : EMPTY;

  /** 편집 결과를 넣고 그 전 멜로디를 되돌리기 기록에 쌓습니다 */
  function commit(next: Note[]) {
    setHistory({
      undo: [...live.undo, melody].slice(-HISTORY_LIMIT),
      redo: [],
      last: next,
    });
    useSongStore.getState().setMelody(next);
  }

  function undo() {
    const target = live.undo.at(-1);
    if (!target) return;
    setHistory({
      undo: live.undo.slice(0, -1),
      redo: [...live.redo, melody],
      last: target,
    });
    useSongStore.getState().setMelody(target);
  }

  function redo() {
    const target = live.redo.at(-1);
    if (!target) return;
    setHistory({
      undo: [...live.undo, melody],
      redo: live.redo.slice(0, -1),
      last: target,
    });
    useSongStore.getState().setMelody(target);
  }

  return {
    commit,
    undo,
    redo,
    canUndo: live.undo.length > 0,
    canRedo: live.redo.length > 0,
  };
}
