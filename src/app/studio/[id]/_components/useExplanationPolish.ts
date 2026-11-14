// 규칙 엔진이 새 설명을 넣으면(분석 직후) /api/analyze로 다듬어 바꿉니다. 회원만.
// 보정 패널(A)을 고치지 않으려고 store를 구독해 "같은 곡 안에서 설명이 바뀐 순간"을 잡습니다.
// docs/specs/07_llm-explanation/design.md §5
import { useEffect } from "react";
import type { AnalyzeRequest } from "@/lib/schemas";
import { useSongStore } from "@/store/songStore";
import type { SongState } from "@/types/song";

// 우리가 넣은 다듬은 문장. 이 문장으로 바뀐 것은 다시 다듬지 않습니다.
let lastPolished: string | null = null;

/** 테스트용 */
export function resetExplanationPolish() {
  lastPolished = null;
}

async function polish(song: SongState, explanation: string) {
  const body: AnalyzeRequest = {
    // 추천 장르 · BPM은 store에 없어 곡의 장르 · 빠르기를 넘깁니다 (서버는 설명 문장에만 씀).
    analysis: {
      key: song.key,
      chords: song.chords,
      recommendedStyle: song.style,
      bpmSuggestion: song.bpm,
      explanation,
    },
  };
  try {
    const response = await fetch("/api/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!response.ok) return;
    const result: { explanation?: string; polished?: boolean } =
      await response.json();
    if (!result.polished || !result.explanation) return;
    const store = useSongStore.getState();
    // 기다리는 사이 다시 분석했거나 다른 곡으로 옮겼으면 이 결과는 버립니다.
    if (store.song.explanation !== explanation) return;
    lastPolished = result.explanation;
    store.setExplanation(result.explanation);
  } catch {
    // 네트워크 오류여도 규칙 엔진 설명이 그대로 있으니 넘어갑니다.
  }
}

export function useExplanationPolish(isMember: boolean): void {
  useEffect(() => {
    if (!isMember) return;
    return useSongStore.subscribe((state, prev) => {
      const explanation = state.song.explanation;
      if (!explanation || explanation === prev.song.explanation) return;
      if (explanation === lastPolished) return;
      // 저장된 곡 열기 · 게스트 보관본 복원 · 비우기는 곡 전체가 바뀝니다. 분석은 같은 멜로디 위에서 키 · 코드 · 설명만 바꿉니다.
      if (
        state.projectId !== prev.projectId ||
        state.song.melody !== prev.song.melody
      )
        return;
      void polish(state.song, explanation);
    });
  }, [isMember]);
}
