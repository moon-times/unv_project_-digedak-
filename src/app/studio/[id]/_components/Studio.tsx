"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useShallow } from "zustand/react/shallow";
import { Timeline } from "@/features/piano-roll/Timeline";
import { useAuthUser } from "@/lib/supabase/useAuthUser";
import {
  getAvailableSteps,
  STUDIO_STEPS,
  useSongStore,
  type SaveStatus,
  type StudioStep,
} from "@/store/songStore";
import {
  ChevronLeftIcon,
  CloudIcon,
  DownloadIcon,
  PlayIcon,
  StopIcon,
} from "./icons";
import { ProgressBar } from "./ProgressBar";
import { Slot } from "./Slot";
import { countBars, formatTime, songDurationSeconds } from "@/lib/transport";

// A·B 패널이 준비되면 Slot 대신 해당 컴포넌트를 넣습니다.
const PANELS: Record<StudioStep, ReactNode> = {
  record: <Slot label="녹음 패널 (빠르기 · 카운트인 포함)" owner="A" />,
  refine: <Slot label="보정 · AI 분석 패널" owner="A" />,
  arrange: <Slot label="반주 패널 (장르 카드 · 빠르기)" owner="B" />,
  mix: <Slot label="믹서 패널" owner="B" />,
};

// 패널 맨 아래 큰 버튼 문구. 마지막 단계(믹싱)는 내보내기 팝업을 엽니다.
const NEXT_LABELS: Record<StudioStep, string> = {
  record: "녹음 끝내고 다음 단계로",
  refine: "다음 단계: 반주 고르기",
  arrange: "다음 단계: 믹싱",
  mix: "내보내기",
};

export function Studio({ projectId }: { projectId: string | null }) {
  // TODO(C §5): projectId가 있으면 Supabase에서 불러와 loadSong()
  const { user, loading } = useAuthUser();
  // 로그인 상태를 확인하는 동안에는 회원 · 게스트 어느 쪽 화면도 보이지 않게 둡니다.
  const auth: Auth = loading ? "loading" : user ? "member" : "guest";
  const step = useSongStore((s) => s.step);
  // song 전체를 구독하면 제목 한 글자마다 타임라인까지 다시 그려지므로, 열린 단계 목록만 구독합니다.
  const available = useSongStore(useShallow((s) => getAvailableSteps(s.song)));
  const setStep = useSongStore((s) => s.setStep);

  return (
    <div className="flex h-dvh flex-col">
      <StudioHeader auth={auth} projectId={projectId} />
      <ProgressBar current={step} available={available} onSelect={setStep} />

      <div className="flex min-h-0 flex-1">
        <main className="min-w-0 flex-1 px-5 pt-4 pb-5">
          {/* TODO(B): 재생 위치가 정해지면 position으로 넘기기 */}
          <Timeline />
        </main>
        <aside className="flex w-[380px] shrink-0 flex-col gap-4 border-l-2 border-foreground/10 px-5 pt-5 pb-5">
          <div className="min-h-0 flex-1">{PANELS[step]}</div>
          <NextStepButton step={step} available={available} onNext={setStep} />
        </aside>
      </div>

      <TransportBar />
    </div>
  );
}

function NextStepButton({
  step,
  available,
  onNext,
}: {
  step: StudioStep;
  available: StudioStep[];
  onNext: (step: StudioStep) => void;
}) {
  const next = STUDIO_STEPS[STUDIO_STEPS.indexOf(step) + 1];
  // TODO(C §3): 믹싱 단계에서는 내보내기 팝업 열기
  const disabled = next ? !available.includes(next) : true;

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => next && onNext(next)}
      className="flex min-h-[52px] w-full items-center justify-center gap-2 rounded-full border-2 border-foreground bg-foreground px-5 text-[17px] font-bold text-background shadow-[0_4px_0_var(--foreground)] disabled:opacity-40 disabled:shadow-none"
    >
      {step === "mix" && <DownloadIcon size={18} />}
      {NEXT_LABELS[step]}
    </button>
  );
}

type Auth = "loading" | "guest" | "member";

function StudioHeader({
  auth,
  projectId,
}: {
  auth: Auth;
  projectId: string | null;
}) {
  const isGuest = auth === "guest";
  const title = useSongStore((s) => s.song.title);
  const setTitle = useSongStore((s) => s.setTitle);
  const saveStatus = useSongStore((s) => s.saveStatus);
  const dirty = useSongStore((s) => s.dirty);
  const lastSavedAt = useSongStore((s) => s.lastSavedAt);

  return (
    <header className="flex h-[65px] shrink-0 items-center gap-3.5 px-5">
      {auth === "loading" ? (
        // 돌아갈 곳이 정해지기 전에는 같은 크기의 빈 칸만 둡니다.
        <span aria-hidden className="size-11 shrink-0" />
      ) : (
        <Link
          href={isGuest ? "/" : "/projects"}
          aria-label={
            isGuest ? "처음 화면으로 돌아가기" : "내 프로젝트로 돌아가기"
          }
          className="flex size-11 shrink-0 items-center justify-center rounded-full hover:bg-foreground/5"
        >
          <ChevronLeftIcon />
        </Link>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          aria-label="곡 제목"
          className="min-w-0 bg-transparent text-[22px] leading-tight font-semibold outline-none"
        />
        <span className="flex items-center gap-1.5 text-[13px] opacity-70">
          <CloudIcon size={15} />
          {auth !== "loading" &&
            saveStatusText(isGuest, saveStatus, dirty, lastSavedAt)}
        </span>
      </div>

      {isGuest && (
        <Link
          href={`/login?next=/studio/${projectId ?? "new"}`}
          className="flex min-h-11 items-center rounded-full border-2 border-foreground px-4 text-[15px] font-semibold"
        >
          로그인
        </Link>
      )}
      {/* TODO(C §3): 내보내기 팝업 (회원: WAV · 저장 / 게스트: 로그인 안내) */}
      <button
        type="button"
        disabled
        className="flex min-h-11 items-center gap-2 rounded-full border-2 border-foreground bg-foreground px-5 text-[15px] font-bold text-background shadow-[0_3px_0_var(--foreground)] disabled:opacity-40 disabled:shadow-none"
      >
        <DownloadIcon size={18} />
        내보내기
      </button>
    </header>
  );
}

export function saveStatusText(
  isGuest: boolean,
  status: SaveStatus,
  dirty: boolean,
  lastSavedAt: number | null,
) {
  if (isGuest) return "게스트로 작업 중이에요. 저장하려면 로그인하세요";
  if (status === "saving") return "저장 중...";
  if (status === "error") return "저장하지 못했어요";
  if (dirty) return "저장 전 변경 사항이 있어요";
  if (status === "saved" && lastSavedAt !== null) {
    const time = new Date(lastSavedAt).toLocaleTimeString("ko-KR", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
    return `${time}에 자동 저장됨`;
  }
  return "자동 저장 켜짐";
}

// BPM은 녹음 패널(A)과 반주 패널(B)에서 바꾸고, 재생 바는 보여 주기만 합니다.
function TransportBar() {
  const song = useSongStore((s) => s.song);
  const [beats, beatUnit] = song.timeSignature;
  const bars = countBars(song);

  return (
    <footer className="flex h-[66px] shrink-0 items-center gap-4 border-t-2 border-foreground/80 px-5">
      {/* TODO(B): player.play() / stop() 연결, 재생 위치 표시 */}
      <div className="flex gap-2">
        <button
          type="button"
          disabled
          aria-label="재생"
          className="flex size-[46px] items-center justify-center rounded-full border-2 border-foreground bg-foreground text-background disabled:opacity-40"
        >
          <PlayIcon />
        </button>
        <button
          type="button"
          disabled
          aria-label="정지"
          className="flex size-[46px] items-center justify-center rounded-full border-2 border-foreground disabled:opacity-40"
        >
          <StopIcon size={16} />
        </button>
      </div>
      <span className="text-[19px] font-bold tabular-nums">
        0:00 / {formatTime(songDurationSeconds(song))}
      </span>
      <span className="text-[15px] opacity-70">
        {song.bpm} BPM, {beats}/{beatUnit}박자
        {bars > 0 && `, ${bars}마디`}
      </span>
    </footer>
  );
}
