"use client";

import type { ReactNode } from "react";
import {
  getAvailableSteps,
  useSongStore,
  type SaveStatus,
  type StudioStep,
} from "@/store/songStore";
import { ProgressBar } from "./ProgressBar";
import { Slot } from "./Slot";

// A·B 패널이 준비되면 Slot 대신 해당 컴포넌트를 넣습니다.
const PANELS: Record<StudioStep, ReactNode> = {
  record: <Slot label="녹음 패널" owner="A" />,
  refine: <Slot label="보정 · AI 분석 패널" owner="A" />,
  arrange: <Slot label="반주 패널 (장르 카드)" owner="B" />,
  mix: <Slot label="믹서 패널" owner="B" />,
};

export function Studio({ projectId }: { projectId: string | null }) {
  // TODO(C §5): projectId가 있으면 Supabase에서 불러와 loadSong()
  const step = useSongStore((s) => s.step);
  const song = useSongStore((s) => s.song);
  const setStep = useSongStore((s) => s.setStep);

  const available = getAvailableSteps(song);
  const next = available[available.indexOf(step) + 1];

  return (
    <div className="flex h-dvh flex-col">
      <StudioHeader isGuest={projectId === null} />
      <ProgressBar current={step} available={available} onSelect={setStep} />

      <div className="flex min-h-0 flex-1">
        <main className="min-w-0 flex-1 p-4">
          <Slot
            label="타임라인 (코드 레인 · 멜로디 피아노롤 · 드럼 · 베이스 · 건반)"
            owner="A"
          />
        </main>
        <aside className="flex w-80 shrink-0 flex-col gap-3 border-l border-foreground/10 p-4">
          <div className="min-h-0 flex-1">{PANELS[step]}</div>
          {next && (
            <button
              type="button"
              onClick={() => setStep(next)}
              className="rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background"
            >
              다음 단계
            </button>
          )}
        </aside>
      </div>

      <TransportBar />
    </div>
  );
}

function StudioHeader({ isGuest }: { isGuest: boolean }) {
  const title = useSongStore((s) => s.song.title);
  const setTitle = useSongStore((s) => s.setTitle);
  const saveStatus = useSongStore((s) => s.saveStatus);
  const dirty = useSongStore((s) => s.dirty);

  return (
    <header className="flex h-14 shrink-0 items-center gap-4 border-b border-foreground/10 px-4">
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        aria-label="곡 제목"
        className="min-w-0 flex-1 bg-transparent text-lg font-semibold outline-none"
      />
      <span className="text-sm opacity-60">
        {saveStatusText(isGuest, saveStatus, dirty)}
      </span>
      {/* TODO(C §3): 내보내기 팝업 (회원: WAV·저장 / 게스트: 로그인 안내) */}
      <button
        type="button"
        disabled
        className="rounded-md border border-foreground/20 px-3 py-1.5 text-sm disabled:opacity-40"
      >
        내보내기
      </button>
    </header>
  );
}

function saveStatusText(isGuest: boolean, status: SaveStatus, dirty: boolean) {
  if (isGuest) return "게스트 · 저장되지 않음";
  if (status === "saving") return "저장 중...";
  if (status === "error") return "저장 실패";
  if (dirty) return "변경 사항 있음";
  return status === "saved" ? "저장됨" : "";
}

function TransportBar() {
  const bpm = useSongStore((s) => s.song.bpm);
  const setBpm = useSongStore((s) => s.setBpm);

  return (
    <footer className="flex h-14 shrink-0 items-center gap-4 border-t border-foreground/10 px-4 text-sm">
      {/* TODO(B): player.play() / stop() 연결 */}
      <button
        type="button"
        disabled
        className="rounded-md border border-foreground/20 px-3 py-1.5 disabled:opacity-40"
      >
        재생
      </button>
      <label className="flex items-center gap-2">
        BPM
        <input
          type="number"
          min={40}
          max={240}
          value={bpm}
          onChange={(e) => {
            const value = Number(e.target.value);
            if (value > 0) setBpm(value);
          }}
          className="w-16 rounded border border-foreground/20 bg-transparent px-2 py-1"
        />
      </label>
      <span className="tabular-nums opacity-60">0:00</span>
    </footer>
  );
}
