"use client";
// ② 보정 · AI 분석 패널: 규칙 엔진(analyzeSong)이 찾은 키 · 코드 · 추천 장르 · BPM과 설명.
// 제목과 한 줄 설명은 스튜디오 틀이 그립니다. 피아노롤 편집 도구는 타임라인 쪽에 따로 붙습니다.
//
// 분석 시점: 패널을 열 때 코드가 비어 있으면(첫 분석, 다시 녹음한 뒤) 한 번, 그리고 [다시 분석] 버튼.
// 음표를 고칠 때마다 자동으로 다시 분석하지는 않습니다.
import { useEffect, useState } from "react";
import { Soon } from "@/app/_components/Soon";
import { analyzeSong, koreanKeyName, parseKey, STYLE_LABEL } from "@/lib/music";
import { stepsPerBar } from "@/lib/transport";
import { useSongStore } from "@/store/songStore";
import type { AnalysisResult } from "@/types/song";

/** 지금 곡을 분석합니다. apply면 store에 키 · 코드 · 설명(첫 분석이면 장르도)을 넣습니다 */
function analyzeCurrentSong({ apply }: { apply: boolean }): AnalysisResult {
  const store = useSongStore.getState();
  const { song } = store;
  const result = analyzeSong(song.melody, song.bpm, {
    stepsPerBar: stepsPerBar(song.timeSignature),
  });
  if (apply) {
    // 첫 분석일 때만 추천 장르를 고릅니다. 다시 분석할 때는 사용자가 반주에서 고른 장르를 그대로 둡니다.
    if (song.chords.length === 0) store.setStyle(result.recommendedStyle);
    store.setKey(result.key);
    store.setChords(result.chords);
    store.setExplanation(result.explanation);
  }
  return result;
}

export function RefinePanel() {
  const hasMelody = useSongStore((s) => s.song.melody.length > 0);
  const keyName = useSongStore((s) => s.song.key);
  const bpm = useSongStore((s) => s.song.bpm);
  const explanation = useSongStore((s) => s.song.explanation);
  const setBpm = useSongStore((s) => s.setBpm);
  // 추천 장르 · BPM은 store에 없으므로 마지막 분석 결과를 패널에 둡니다.
  // 코드가 이미 있으면(저장된 곡) store는 건드리지 않고 추천만 다시 계산합니다.
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(() => {
    const { song } = useSongStore.getState();
    return song.melody.length > 0 && song.chords.length > 0
      ? analyzeCurrentSong({ apply: false })
      : null;
  });

  // 코드가 없으면 패널을 열자마자 분석합니다. store를 바꾸므로 렌더가 아니라 effect에서 합니다.
  useEffect(() => {
    const { song } = useSongStore.getState();
    if (song.melody.length > 0 && song.chords.length === 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- 외부 store 기준으로 한 번만 분석
      setAnalysis(analyzeCurrentSong({ apply: true }));
    }
  }, []);

  if (!hasMelody) {
    return (
      <p className="text-[15px] text-ink-muted">
        먼저 ① 녹음에서 멜로디를 불러 주세요.
      </p>
    );
  }

  const key = parseKey(keyName);
  const suggested = analysis?.bpmSuggestion;

  return (
    <div className="flex h-full flex-col gap-4 overflow-y-auto">
      <div className="grid grid-cols-3 gap-2.5">
        <Card label="키">{key ? koreanKeyName(key) : keyName}</Card>
        <Card label="추천 장르">
          {analysis ? STYLE_LABEL[analysis.recommendedStyle] : "–"}
        </Card>
        <Card label="빠르기">
          <span className="tabular-nums">{bpm}</span>
          <span className="ml-0.5 text-[13px]">BPM</span>
        </Card>
      </div>

      {suggested !== undefined && suggested !== bpm && (
        <div className="flex items-center justify-between gap-3 rounded-xl border-2 border-ink bg-paper px-4 py-2.5 text-[14px]">
          <span>
            이 장르에는{" "}
            <strong className="tabular-nums">{suggested} BPM</strong>을
            추천해요.
          </span>
          <button
            type="button"
            onClick={() => setBpm(suggested)}
            className="min-h-11 shrink-0 rounded-full border-2 border-ink bg-surface px-4 font-semibold"
          >
            적용
          </button>
        </div>
      )}

      <section className="flex flex-col gap-2 rounded-xl border-2 border-ink bg-surface px-4 py-3">
        <h3 className="font-display text-[19px]">왜 이 코드일까요?</h3>
        <p className="text-[14px] leading-relaxed whitespace-pre-line">
          {explanation ?? "아직 분석하지 않았어요."}
        </p>
      </section>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setAnalysis(analyzeCurrentSong({ apply: true }))}
          className="min-h-11 rounded-full border-2 border-ink bg-surface px-4 text-[15px] font-semibold shadow-[0_3px_0_var(--color-ink)]"
        >
          다시 분석
        </button>
        <button
          type="button"
          disabled
          className="min-h-11 rounded-full border-2 border-ink bg-surface px-4 text-[15px] font-semibold disabled:opacity-40"
        >
          더 밝게
        </button>
        <button
          type="button"
          disabled
          className="min-h-11 rounded-full border-2 border-ink bg-surface px-4 text-[15px] font-semibold disabled:opacity-40"
        >
          더 슬프게
        </button>
      </div>
      <p className="text-[13px] text-ink-muted">
        음을 고친 뒤에는 [다시 분석]을 눌러 코드를 새로 찾으세요.
      </p>

      <div className="flex items-center gap-2 rounded-xl border-2 border-dashed border-line-dashed px-4 py-3 text-[14px] text-ink-muted">
        다른 느낌으로 다시 추천
        <Soon />
      </div>
    </div>
  );
}

function Card({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1 rounded-xl border-2 border-ink bg-surface px-3 py-2.5 shadow-[0_3px_0_var(--color-ink)]">
      <span className="text-[12px] font-semibold text-ink-muted">{label}</span>
      <span className="font-display text-[20px] leading-tight">{children}</span>
    </div>
  );
}
