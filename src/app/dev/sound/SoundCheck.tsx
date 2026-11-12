"use client";
// 녹음 · 보정 패널 없이 B 음악 엔진(분석 → 반주 → 재생 → 믹서)을 귀로 확인하는 화면.
import { useEffect, useState } from "react";
import { ArrangePanel } from "@/features/arranger/ArrangePanel";
import { MixerPanel } from "@/features/mixer/MixerPanel";
import { Timeline } from "@/features/piano-roll/Timeline";
import {
  player,
  usePlayerState,
  useSyncPlayerWithSong,
} from "@/features/player";
import { GUEST_DRAFT_KEY, useSongStore } from "@/store/songStore";
import { SAMPLES, sampleSong } from "./samples";

export function SoundCheck() {
  const [sampleId, setSampleId] = useState(SAMPLES[0].id);
  useSampleSession();
  // 첫 샘플이 store에 들어가기 전(빈 곡)에는 패널을 그리지 않습니다. 반주 패널의 AI 추천이 빈 곡으로 계산되지 않게 합니다.
  const ready = useSongStore((s) => s.song.melody.length > 0);

  return (
    <div className="mx-auto flex max-w-[1400px] flex-col gap-5 p-5">
      <header className="flex flex-wrap items-center gap-4">
        <h1 className="font-display text-[28px]">소리 확인 (개발용)</h1>
        <label className="flex items-center gap-2 text-[15px]">
          샘플 멜로디
          <select
            value={sampleId}
            onChange={(e) => {
              loadSample(e.target.value);
              setSampleId(e.target.value);
            }}
            className="min-h-11 rounded-full border-2 border-ink bg-surface px-4"
          >
            {SAMPLES.map((sample) => (
              <option key={sample.id} value={sample.id}>
                {sample.label}
              </option>
            ))}
          </select>
        </label>
        {ready && <Transport />}
      </header>

      {ready && (
        <>
          <Analysis />
          <div className="flex flex-col gap-5 lg:flex-row">
            <div className="min-w-0 flex-1">
              <TimelineWithPlayhead />
            </div>
            <section className="w-full shrink-0 rounded-xl border-2 border-ink bg-surface p-4 lg:w-[340px]">
              <h2 className="mb-3 font-display text-[22px]">반주</h2>
              <ArrangePanel key={sampleId} />
            </section>
            <section className="w-full shrink-0 rounded-xl border-2 border-ink bg-surface p-4 lg:w-[340px]">
              <h2 className="mb-3 font-display text-[22px]">믹서</h2>
              <MixerPanel />
            </section>
          </div>
        </>
      )}
    </div>
  );
}

/**
 * 고른 샘플을 store에 넣습니다.
 * store는 게스트 작업을 localStorage에 보관하므로, 이 화면을 떠날 때 원래 보관본을 되돌려 놓습니다.
 */
function loadSample(sampleId: string) {
  const sample = SAMPLES.find((s) => s.id === sampleId) ?? SAMPLES[0];
  player.stop();
  useSongStore.getState().loadSong(sampleSong(sample), null);
}

/** 첫 샘플을 넣고, 화면을 떠날 때 store와 게스트 보관본을 원래대로 돌려놓습니다. */
function useSampleSession() {
  useEffect(() => {
    let saved: string | null = null;
    try {
      saved = localStorage.getItem(GUEST_DRAFT_KEY);
    } catch {}
    loadSample(SAMPLES[0].id);
    const restoreDraft = () => {
      try {
        if (saved === null) localStorage.removeItem(GUEST_DRAFT_KEY);
        else localStorage.setItem(GUEST_DRAFT_KEY, saved);
      } catch {}
    };
    // 탭 닫기 · 새로고침 때는 cleanup이 돌지 않으므로 pagehide에서도 되돌립니다.
    window.addEventListener("pagehide", restoreDraft);
    return () => {
      window.removeEventListener("pagehide", restoreDraft);
      // reset()도 보관본을 덮어쓰므로, 비운 다음에 원래 보관본을 되돌립니다.
      useSongStore.getState().reset();
      restoreDraft();
    };
  }, []);
}

function Transport() {
  useSyncPlayerWithSong();
  const { status, error } = usePlayerState();
  const playing = status === "playing";

  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        disabled={status === "loading"}
        onClick={() =>
          playing ? player.pause() : player.play().catch(() => {})
        }
        className="min-h-11 rounded-full border-2 border-ink bg-primary px-5 font-bold text-on-primary shadow-[0_3px_0_var(--color-ink)] disabled:opacity-40"
      >
        {playing ? "일시정지" : "재생"}
      </button>
      <button
        type="button"
        onClick={() => player.stop()}
        className="min-h-11 rounded-full border-2 border-ink bg-surface px-5 font-semibold"
      >
        정지
      </button>
      <span role="status" className="text-[14px] text-ink-muted">
        상태: {status}
        {error && ` · ${error}`}
      </span>
    </div>
  );
}

function Analysis() {
  const key = useSongStore((s) => s.song.key);
  const chords = useSongStore((s) => s.song.chords);
  const explanation = useSongStore((s) => s.song.explanation);

  return (
    <section className="rounded-xl border-2 border-ink bg-surface p-4 text-[14px]">
      <p>
        <strong>키</strong> {key} · <strong>코드</strong>{" "}
        {chords.map((chord) => chord.symbol).join(" → ")}
      </p>
      {explanation && <p className="mt-1 text-ink-muted">{explanation}</p>}
    </section>
  );
}

function TimelineWithPlayhead() {
  const { status, step } = usePlayerState();
  const showPlayhead = status === "playing" || status === "paused";
  return <Timeline position={showPlayhead ? step : undefined} />;
}
