// AI 코드 재추천 요청 (명세 11). 보정 패널(A)은 버튼만 두고, 요청 · 곡 반영은 여기서 합니다.
// docs/specs/11_llm-recommend/design.md §5
import { markPolished } from "@/app/studio/[id]/_components/useExplanationPolish";
import type { AnalyzeRequest } from "@/lib/schemas";
import { useSongStore } from "@/store/songStore";
import type { Chord } from "@/types/song";

export type RecommendKind = "brighter" | "sadder";

/** 되돌리기용 바로 앞 코드 · 설명 */
export type RecommendSnapshot = { chords: Chord[]; explanation?: string };

export type RecommendOutcome =
  | {
      status: "applied";
      changed: number;
      previous: RecommendSnapshot;
      /** 곡에 넣은 코드 배열. 곡의 코드가 이 배열 그대로일 때만 되돌리기를 보여 줍니다. */
      applied: Chord[];
    }
  | { status: "no-change" | "stale" | "limited" | "unavailable" | "failed" };

/** 지금 곡의 코드를 다시 추천받아, 바뀐 코드가 있으면 곡에 넣습니다. */
export async function recommendForCurrentSong(
  kind: RecommendKind,
): Promise<RecommendOutcome> {
  const { song } = useSongStore.getState();
  const body: AnalyzeRequest = {
    analysis: {
      key: song.key,
      chords: song.chords,
      recommendedStyle: song.style,
      bpmSuggestion: song.bpm,
      explanation: song.explanation ?? "",
    },
    melody: song.melody,
    request: kind,
  };
  try {
    const response = await fetch("/api/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!response.ok) return { status: "failed" };
    const result: {
      chords?: Chord[];
      explanation?: string;
      recommended?: boolean;
      changed?: number;
      limited?: boolean;
      unavailable?: boolean;
    } = await response.json();
    if (result.limited) return { status: "limited" };
    if (result.unavailable) return { status: "unavailable" };
    if (!result.recommended || !result.chords || !result.explanation)
      return { status: "failed" };
    if (!result.changed) return { status: "no-change" };

    const store = useSongStore.getState();
    // 기다리는 사이 다시 분석 · 녹음 · 다른 곡으로 옮겼으면 버립니다.
    if (store.song.chords !== song.chords || store.song.melody !== song.melody)
      return { status: "stale" };
    const previous = { chords: song.chords, explanation: song.explanation };
    markPolished(result.explanation);
    store.setChords(result.chords);
    store.setExplanation(result.explanation);
    return {
      status: "applied",
      changed: result.changed,
      previous,
      applied: result.chords,
    };
  } catch {
    return { status: "failed" };
  }
}

/** 재추천 전으로 되돌립니다. 되돌린 설명도 다시 다듬지 않습니다. */
export function undoRecommend(previous: RecommendSnapshot) {
  const store = useSongStore.getState();
  store.setChords(previous.chords);
  if (previous.explanation !== undefined) {
    markPolished(previous.explanation);
    store.setExplanation(previous.explanation);
  }
}
