"use client";

import Image from "next/image";
import Link from "next/link";
import mascot from "@/app/icon.png";
import { useSyncExternalStore, type ReactNode } from "react";
import { useShallow } from "zustand/react/shallow";
import { ArrangePanel } from "@/features/arranger/ArrangePanel";
import { MixerPanel } from "@/features/mixer/MixerPanel";
import { MelodyOnlyButton } from "@/features/piano-roll/MelodyOnlyButton";
import { RefinePanel } from "@/features/piano-roll/RefinePanel";
import { Timeline } from "@/features/piano-roll/Timeline";
import { RecordPanel } from "@/features/recorder/RecordPanel";
import { useRecordingPosition } from "@/features/recorder/recordingPosition";
import { useAuthUser } from "@/lib/supabase/useAuthUser";
import { useProjectSync, type SyncPhase } from "./useProjectSync";
import { useRecordingUpload } from "./useRecordingUpload";
import {
  INITIAL_PLAYER_STATE,
  player,
  secondsPerStep,
  usePlayerState,
  useSyncPlayerWithSong,
  type PlayerState,
} from "@/features/player";
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
  PauseIcon,
  PlayIcon,
  StopIcon,
} from "./icons";
import { ProgressBar, STEP_LABELS } from "./ProgressBar";
import { countBars, formatTime, songDurationSeconds } from "@/lib/transport";

const PANELS: Record<StudioStep, ReactNode> = {
  record: <RecordPanel />,
  refine: <RefinePanel />,
  arrange: <ArrangePanel />,
  mix: <MixerPanel />,
};

// 패널 맨 위 한 줄 설명. 제목은 STEP_LABELS. 제목 · 설명은 틀이 그리고 A · B 패널은 도구만 만듭니다.
const PANEL_INTROS: Record<StudioStep, string> = {
  record: "버튼을 누르고 최대 30초 동안 흥얼거려 주세요.",
  refine: "어긋난 음은 피아노롤에서 고치고, AI가 찾은 키와 코드를 확인하세요.",
  arrange: "장르를 고르면 멜로디는 그대로 두고 반주만 새로 만들어요.",
  mix: "트랙마다 소리 크기를 맞추고, 뮤트로 끄거나 솔로로 하나만 들어 보세요.",
};

// 패널 맨 아래 큰 버튼 문구. 마지막 단계(믹싱)는 내보내기 팝업을 엽니다.
const NEXT_LABELS: Record<StudioStep, string> = {
  record: "녹음 끝내고 다음 단계로",
  refine: "다음 단계: 반주 고르기",
  arrange: "다음 단계: 믹싱",
  mix: "내보내기",
};

/** @param projectId 주소의 id. `/studio/new`면 null */
export function Studio({ projectId }: { projectId: string | null }) {
  const { user, loading } = useAuthUser();
  // 로그인 상태를 확인하는 동안에는 회원 · 게스트 어느 쪽 화면도 보이지 않게 둡니다.
  const auth: Auth = loading ? "loading" : user ? "member" : "guest";
  const phase = useProjectSync(projectId, auth === "member");
  useRecordingUpload(auth === "member");
  const step = useSongStore((s) => s.step);
  // song 전체를 구독하면 제목 한 글자마다 타임라인까지 다시 그려지므로, 열린 단계 목록만 구독합니다.
  const available = useSongStore(useShallow((s) => getAvailableSteps(s.song)));
  const setStep = useSongStore((s) => s.setStep);

  // 불러오기가 끝나기 전에는 편집할 수 없게 스튜디오 대신 안내만 보여 줍니다.
  if (phase !== "ready") return <SyncMessage phase={phase} />;

  return (
    <div className="flex h-dvh flex-col">
      <StudioHeader auth={auth} />
      <ProgressBar current={step} available={available} onSelect={setStep} />

      <div className="flex min-h-0 flex-1">
        <main className="min-w-0 flex-1 px-5 pt-4 pb-5">
          <TimelineWithPlayhead />
        </main>
        <aside className="flex w-[380px] shrink-0 flex-col gap-4 border-l-2 border-ink bg-surface px-5 pt-5 pb-5">
          <div>
            <h2 className="font-display text-[28px] leading-tight">
              {STEP_LABELS[step]}
            </h2>
            <p className="mt-1 text-[14px] text-ink-muted">
              {PANEL_INTROS[step]}
            </p>
          </div>
          <div className="min-h-0 flex-1">{PANELS[step]}</div>
          <NextStepButton step={step} available={available} onNext={setStep} />
        </aside>
      </div>

      <TransportBar />
    </div>
  );
}

const SYNC_MESSAGES: Record<Exclude<SyncPhase, "ready">, string> = {
  loading: "곡을 여는 중...",
  "not-found": "프로젝트를 찾을 수 없어요",
  invalid: "곡을 열 수 없어요. 저장된 데이터 형식이 맞지 않아요",
  error: "곡을 불러오지 못했어요. 잠시 뒤 새로고침해 주세요",
};

function SyncMessage({ phase }: { phase: Exclude<SyncPhase, "ready"> }) {
  return (
    <div className="flex h-dvh flex-col items-center justify-center gap-4 p-6 text-center">
      <Image src={mascot} alt="" width={120} height={120} />
      <p role={phase === "loading" ? "status" : "alert"} className="text-lg">
        {SYNC_MESSAGES[phase]}
      </p>
      {phase !== "loading" && (
        <Link
          href="/projects"
          className="flex min-h-11 items-center rounded-full border-2 border-ink bg-surface px-5 font-semibold shadow-[0_3px_0_var(--color-ink)]"
        >
          내 프로젝트로
        </Link>
      )}
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
      className="flex min-h-[52px] w-full items-center justify-center gap-2 rounded-full border-2 border-ink bg-primary px-5 text-[17px] font-bold text-on-primary shadow-[0_4px_0_var(--color-ink)] disabled:opacity-40 disabled:shadow-none"
    >
      {step === "mix" && <DownloadIcon size={18} />}
      {NEXT_LABELS[step]}
    </button>
  );
}

type Auth = "loading" | "guest" | "member";

function StudioHeader({ auth }: { auth: Auth }) {
  const isGuest = auth === "guest";
  // 새 곡이 처음 저장되면 주소가 /studio/{id}로 바뀌므로 store의 id를 씁니다.
  const projectId = useSongStore((s) => s.projectId);
  const title = useSongStore((s) => s.song.title);
  const setTitle = useSongStore((s) => s.setTitle);
  const saveStatus = useSongStore((s) => s.saveStatus);
  const dirty = useSongStore((s) => s.dirty);
  const lastSavedAt = useSongStore((s) => s.lastSavedAt);

  return (
    <header className="flex h-[66px] shrink-0 items-center gap-3.5 border-b-2 border-ink bg-surface px-5">
      {auth === "loading" ? (
        // 돌아갈 곳이 정해지기 전에는 같은 크기의 빈 칸만 둡니다.
        <span aria-hidden className="size-11 shrink-0" />
      ) : (
        <Link
          href={isGuest ? "/" : "/projects"}
          aria-label={
            isGuest ? "처음 화면으로 돌아가기" : "내 프로젝트로 돌아가기"
          }
          className="flex size-11 shrink-0 items-center justify-center rounded-full hover:bg-ink/5"
        >
          <ChevronLeftIcon />
        </Link>
      )}
      <Image src={mascot} alt="" width={40} height={40} className="shrink-0" />

      <div className="flex min-w-0 flex-1 flex-col">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          aria-label="곡 제목"
          className="min-w-0 bg-transparent font-display text-[22px] leading-tight outline-none"
        />
        <span className="flex items-center gap-1.5 text-[13px] text-ink-muted">
          <CloudIcon size={15} />
          {auth !== "loading" &&
            saveStatusText(isGuest, saveStatus, dirty, lastSavedAt)}
        </span>
      </div>

      {isGuest && (
        <Link
          href={`/login?next=/studio/${projectId ?? "new"}`}
          className="flex min-h-11 items-center rounded-full border-2 border-ink bg-surface px-4 text-[15px] font-semibold"
        >
          로그인
        </Link>
      )}
      {/* TODO(C §3): 내보내기 팝업 (회원: WAV · 저장 / 게스트: 로그인 안내) */}
      <button
        type="button"
        disabled
        className="flex min-h-11 items-center gap-2 rounded-full border-2 border-ink bg-primary px-5 text-[15px] font-bold text-on-primary shadow-[0_3px_0_var(--color-ink)] disabled:opacity-40 disabled:shadow-none"
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

// BPM은 녹음 패널(A)과 반주 패널(B)에서 바꾸고, 재생 바는 재생 조작과 표시만 합니다.
function TransportBar() {
  // 곡이 바뀌면 재생기에 반영하고, 스튜디오를 나가면 재생을 멈춥니다.
  useSyncPlayerWithSong();
  const song = useSongStore((s) => s.song);
  // 재생 위치는 프레임마다 바뀌지만 재생 바에는 상태와 초 단위 시간만 필요해서, 그 값이 바뀔 때만 다시 그립니다.
  const status = usePlayerValue((s) => s.status);
  const atStart = usePlayerValue((s) => s.step === 0);
  const seconds = usePlayerValue((s) =>
    Math.floor(s.step * secondsPerStep(song.bpm)),
  );
  const [beats, beatUnit] = song.timeSignature;
  const bars = countBars(song);
  const playing = status === "playing";
  const loading = status === "loading";

  return (
    <footer className="flex h-[66px] shrink-0 items-center gap-4 border-t-2 border-ink bg-surface px-5">
      <div className="flex gap-2">
        <button
          type="button"
          disabled={bars === 0 || loading}
          aria-label={playing ? "일시정지" : "재생"}
          // 첫 재생은 이 클릭 안에서 오디오를 켜고 악기를 받습니다. 실패는 status로 보여 줍니다.
          onClick={() =>
            playing ? player.pause() : player.play().catch(() => {})
          }
          className="flex size-[46px] items-center justify-center rounded-full border-2 border-ink bg-primary text-on-primary disabled:opacity-40"
        >
          {playing ? <PauseIcon /> : <PlayIcon />}
        </button>
        <button
          type="button"
          disabled={!playing && atStart}
          aria-label="정지"
          onClick={() => player.stop()}
          className="flex size-[46px] items-center justify-center rounded-full border-2 border-ink bg-surface disabled:opacity-40"
        >
          <StopIcon size={16} />
        </button>
      </div>
      <span className="text-[19px] font-bold tabular-nums">
        {formatTime(seconds)} / {formatTime(songDurationSeconds(song))}
      </span>
      <span className="text-[15px] text-ink-muted">
        {song.bpm} BPM, {beats}/{beatUnit}박자
        {bars > 0 && `, ${bars}마디`}
      </span>
      {(loading || status === "error") && (
        <span role="status" className="text-[15px] text-ink-muted">
          {loading
            ? "악기 소리를 불러오는 중..."
            : "소리를 켜지 못했어요. 다시 눌러 보세요"}
        </span>
      )}
    </footer>
  );
}

/** 재생기 상태 중 필요한 값 하나만 구독합니다. pick은 원시값(문자열 · 숫자 · 불리언)을 돌려줘야 합니다. */
function usePlayerValue<T extends string | number | boolean>(
  pick: (state: PlayerState) => T,
): T {
  return useSyncExternalStore(
    player.subscribe,
    () => pick(player.getState()),
    () => pick(INITIAL_PLAYER_STATE),
  );
}

// 재생 위치만 프레임마다 바뀌므로, 위치를 구독하는 부분을 따로 둡니다.
function TimelineWithPlayhead() {
  const { status, step } = usePlayerState();
  const studioStep = useSongStore((s) => s.step);
  const recordingStep = useRecordingPosition();
  const showPlayhead = status === "playing" || status === "paused";
  // 녹음 중이면 녹음 위치를 주황 재생선으로 (녹음 전에 재생을 멈추므로 둘이 겹치지 않음)
  if (recordingStep !== null)
    return <Timeline position={recordingStep} recording />;
  return (
    <Timeline
      position={showPlayhead ? step : undefined}
      // 멜로디 편집은 ② 보정 단계에서만
      editable={studioStep === "refine"}
      onSeek={seekTo}
      tools={<MelodyOnlyButton />}
    />
  );
}

/** 마디 번호 줄을 누르면 그 위치로. 멈춰 있을 때도 다음 재생이 그 위치부터 시작합니다 */
function seekTo(step: number) {
  player.seek(step);
}
