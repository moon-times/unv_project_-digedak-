// 내보내기 팝업. 회원은 WAV를 받고, 게스트는 로그인 안내를 봅니다.
// docs/specs/04_export-wav/design.md §4
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Soon } from "@/app/_components/Soon";
import { exportWav, wavFileName } from "@/features/editor/exportWav";
import type { RenderProgress } from "@/features/player";
import { formatTime, songDurationSeconds } from "@/lib/transport";
import { useSongStore } from "@/store/songStore";
import { DownloadIcon } from "./icons";

type ExportState =
  | { kind: "idle" | "loading" | "done" | "error" }
  | { kind: "rendering"; ratio: number };

function toState(progress: RenderProgress): ExportState {
  return progress.phase === "loading"
    ? { kind: "loading" }
    : { kind: "rendering", ratio: progress.ratio };
}

const PRIMARY =
  "flex min-h-11 items-center justify-center gap-2 rounded-full border-2 border-ink bg-primary px-5 text-[15px] font-bold text-on-primary shadow-[0_3px_0_var(--color-ink)] disabled:opacity-40 disabled:shadow-none";
const SECONDARY =
  "flex min-h-11 items-center justify-center rounded-full border-2 border-ink bg-surface px-5 text-[15px] font-semibold";

export function ExportDialog({
  member,
  open,
  onClose,
}: {
  member: boolean;
  open: boolean;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    if (open && !element.open) element.showModal();
    if (!open && element.open) element.close();
  }, [open]);

  return (
    <dialog
      ref={dialog}
      aria-labelledby="export-title"
      onClose={onClose}
      // 바깥 막을 누르면 닫습니다. 안쪽 여백은 div가 덮어서 target이 dialog 자신이면 막입니다.
      onClick={(e) => e.target === e.currentTarget && e.currentTarget.close()}
      className="m-auto w-[min(92vw,460px)] rounded-[14px] border-2 border-ink bg-surface p-0 text-ink shadow-[0_8px_0_var(--color-ink)] backdrop:bg-ink/55"
    >
      <div className="p-6">
        {open && (member ? <MemberExport /> : <GuestExport />)}
      </div>
    </dialog>
  );
}

function CloseButton() {
  return (
    <form method="dialog">
      <button
        aria-label="닫기"
        className="flex size-11 items-center justify-center rounded-full text-[22px] hover:bg-ink/5"
      >
        ×
      </button>
    </form>
  );
}

function MemberExport() {
  const title = useSongStore((s) => s.song.title);
  const setTitle = useSongStore((s) => s.setTitle);
  const seconds = useSongStore((s) => songDurationSeconds(s.song));
  const lastSavedAt = useSongStore((s) => s.lastSavedAt);
  const [state, setState] = useState<ExportState>({ kind: "idle" });
  // 팝업이 닫히면(이 컴포넌트가 사라지면) 진행 중인 렌더링 결과를 버립니다.
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const busy = state.kind === "loading" || state.kind === "rendering";

  async function download() {
    const { song } = useSongStore.getState();
    setState({ kind: "loading" });
    try {
      const blob = await exportWav(song, (progress) => {
        if (alive.current) setState(toState(progress));
      });
      if (!alive.current) return;
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = wavFileName(song.title);
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setState({ kind: "done" });
    } catch {
      if (alive.current) setState({ kind: "error" });
    }
  }

  return (
    <>
      <div className="flex items-center justify-between">
        <h2 id="export-title" className="font-display text-[28px]">
          내보내기
        </h2>
        <CloseButton />
      </div>

      <label className="mt-3 block text-[14px] font-semibold">
        곡 제목
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="mt-1 block min-h-11 w-full rounded-xl border-2 border-ink bg-paper px-3 text-[16px] font-normal"
        />
      </label>

      <section className="mt-4 rounded-xl border-2 border-ink bg-paper p-4">
        <div className="flex items-baseline justify-between">
          <h3 className="text-[16px] font-bold">WAV 파일</h3>
          <span className="text-[13px] text-ink-muted">
            길이 {formatTime(seconds)}
          </span>
        </div>
        <p className="mt-1 text-[14px] text-ink-muted">
          멜로디와 반주(드럼 · 베이스 · 건반 · 기타) 5트랙을 하나로 합쳐요.
        </p>
        <button
          type="button"
          disabled={busy}
          onClick={download}
          className={`${PRIMARY} mt-3 w-full`}
        >
          <DownloadIcon size={18} />
          WAV 다운로드
        </button>
        <Progress state={state} onRetry={download} />
      </section>

      <p className="mt-4 text-[13px] text-ink-muted">
        프로젝트는 자동 저장돼요.
        {lastSavedAt !== null && ` 마지막 저장 ${timeLabel(lastSavedAt)}`}
      </p>
      <p className="mt-2 flex items-center gap-2 text-[13px] text-ink-muted">
        WAV를 내 프로젝트에도 보관하기 <Soon />
      </p>
    </>
  );
}

function Progress({
  state,
  onRetry,
}: {
  state: ExportState;
  onRetry: () => void;
}) {
  const ratio =
    state.kind === "rendering" ? state.ratio : state.kind === "done" ? 1 : 0;
  const message =
    state.kind === "loading"
      ? "악기 불러오는 중..."
      : state.kind === "rendering"
        ? `WAV로 만드는 중 ${Math.round(state.ratio * 100)}%`
        : state.kind === "done"
          ? "다운로드했어요"
          : state.kind === "error"
            ? "WAV를 만들지 못했어요. 다시 시도해 주세요."
            : "";

  return (
    // 처음(idle)에는 빈 문구만 있어 높이 0. 낭독기 알림을 위해 role="status"는 항상 둡니다.
    <div
      className={`flex items-center gap-3 ${state.kind === "idle" ? "" : "mt-3 min-h-11"}`}
    >
      {(state.kind === "loading" || state.kind === "rendering") && (
        <div
          role="progressbar"
          aria-label="WAV 만드는 진행률"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(ratio * 100)}
          className="h-3 flex-1 overflow-hidden rounded-full border-2 border-ink bg-paper"
        >
          <div
            className="h-full bg-primary transition-[width]"
            style={{ width: `${ratio * 100}%` }}
          />
        </div>
      )}
      <p
        role="status"
        className={`text-[14px] ${state.kind === "error" ? "flex-1 text-danger" : "text-ink-muted"}`}
      >
        {message}
      </p>
      {state.kind === "error" && (
        <button type="button" onClick={onRetry} className={SECONDARY}>
          다시 시도
        </button>
      )}
    </div>
  );
}

function GuestExport() {
  const projectId = useSongStore((s) => s.projectId);

  return (
    <>
      <div className="flex items-center justify-between">
        <h2 id="export-title" className="font-display text-[24px]">
          로그인하면 바로 저장할 수 있어요
        </h2>
        <CloseButton />
      </div>
      <p className="mt-2 text-[15px] leading-relaxed text-ink-muted">
        WAV 다운로드와 프로젝트 저장은 회원 기능이에요. 로그인해도 지금 만든
        곡은 그대로 이어져요.
      </p>
      <div className="mt-5 flex flex-col gap-2">
        <Link
          href={`/login?next=/studio/${projectId ?? "new"}`}
          className={PRIMARY}
        >
          로그인하고 저장하기
        </Link>
        <form method="dialog">
          <button className={`${SECONDARY} w-full`}>계속 편집하기</button>
        </form>
      </div>
    </>
  );
}

function timeLabel(at: number) {
  return new Date(at).toLocaleTimeString("ko-KR", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}
