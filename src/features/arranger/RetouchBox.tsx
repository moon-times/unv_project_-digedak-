"use client";
// AI 리터치 상자 (반주 패널 아래). 버튼 → 서버가 편곡 계획을 주면 곡에 넣고, 반주는 엔진이 계획대로 다시 만듭니다.
// [원래] / [AI 편곡] 전환과 [되돌리기]는 횟수를 쓰지 않습니다. docs/specs/08_llm-retouch/design.md §6
import { useEffect, useState } from "react";
import { useSongStore } from "@/store/songStore";
import type { ArrangementPlan } from "@/types/song";

type Status = "idle" | "loading" | "error" | "daily";

/** 자동 저장이 끝날 때까지 기다립니다. 서버는 저장된 곡으로 계획하므로, 방금 바꾼 코드가 반영되게 합니다. */
export function waitForSave(timeoutMs = 10_000): Promise<boolean> {
  if (!useSongStore.getState().dirty) return Promise.resolve(true);
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      unsubscribe();
      resolve(false);
    }, timeoutMs);
    const unsubscribe = useSongStore.subscribe((state) => {
      if (state.dirty) return;
      clearTimeout(timer);
      unsubscribe();
      resolve(true);
    });
  });
}

const TOGGLE =
  "min-h-11 flex-1 rounded-full border-2 border-ink px-3 text-[14px] font-semibold aria-pressed:bg-ink aria-pressed:text-surface";

export function RetouchBox() {
  const projectId = useSongStore((s) => s.projectId);
  const arrangement = useSongStore((s) => s.song.arrangement);
  const setArrangement = useSongStore((s) => s.setArrangement);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  // 되돌리기용 바로 앞 계획. { plan: undefined }는 "계획 없던 원래 반주"
  const [previous, setPrevious] = useState<{ plan?: ArrangementPlan } | null>(
    null,
  );

  useEffect(() => {
    if (!projectId) return;
    let alive = true;
    fetch(`/api/retouch?projectId=${projectId}`)
      .then((response) => (response.ok ? response.json() : null))
      .then((body) => {
        if (alive && typeof body?.remaining === "number")
          setRemaining(body.remaining);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [projectId]);

  if (!projectId)
    return (
      <Box>
        <p className="text-[14px] text-ink-muted">
          저장된 곡에서 쓸 수 있어요. 로그인하면 곡이 자동 저장돼요.
        </p>
      </Box>
    );

  async function retouch() {
    setStatus("loading");
    try {
      if (!(await waitForSave())) throw new Error("저장이 끝나지 않았어요");
      const response = await fetch("/api/retouch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId }),
      });
      const body = await response.json();
      if (typeof body?.remaining === "number") setRemaining(body.remaining);
      // 기다리는 사이 다른 곡을 열었으면 버립니다.
      if (useSongStore.getState().projectId !== projectId) return;
      if (body?.plan) {
        setPrevious({ plan: useSongStore.getState().song.arrangement });
        setArrangement({ ...body.plan, enabled: true });
        setStatus("idle");
      } else {
        setStatus(
          body?.limited ? "idle" : body?.dailyLimited ? "daily" : "error",
        );
      }
    } catch {
      setStatus("error");
    }
  }

  function undo() {
    if (!previous) return;
    setArrangement(previous.plan);
    setPrevious(null);
  }

  const used = remaining === 0;

  return (
    <Box>
      <button
        type="button"
        onClick={retouch}
        disabled={status === "loading" || used}
        className="flex min-h-11 w-full items-center justify-center rounded-full border-2 border-ink bg-primary px-4 text-[15px] font-bold text-on-primary shadow-[0_3px_0_var(--color-ink)] disabled:opacity-40 disabled:shadow-none"
      >
        AI로 풍성하게
        {remaining !== null && ` (남은 ${remaining}회)`}
      </button>
      <p role="status" className="text-[13px] text-ink-muted empty:hidden">
        {status === "loading"
          ? "AI가 곡 구성을 짜는 중이에요..."
          : status === "daily"
            ? "오늘 쓸 수 있는 AI 편곡 횟수를 다 썼어요. 내일 다시 해 주세요."
            : status === "error"
              ? "편곡을 만들지 못했어요. 이 곡의 횟수는 그대로예요. 다시 시도해 주세요."
              : used
                ? "이 곡의 AI 편곡을 다 썼어요."
                : ""}
      </p>

      {arrangement && (
        <>
          <div className="flex gap-2" role="group" aria-label="반주 비교">
            <button
              type="button"
              aria-pressed={!arrangement.enabled}
              onClick={() => setArrangement({ ...arrangement, enabled: false })}
              className={TOGGLE}
            >
              원래
            </button>
            <button
              type="button"
              aria-pressed={arrangement.enabled}
              onClick={() => setArrangement({ ...arrangement, enabled: true })}
              className={TOGGLE}
            >
              AI 편곡
            </button>
          </div>
          {arrangement.enabled && arrangement.summary && (
            <p className="text-[14px] leading-relaxed">{arrangement.summary}</p>
          )}
        </>
      )}
      {previous && (
        <button
          type="button"
          onClick={undo}
          className="min-h-11 self-start rounded-full px-3 text-[14px] font-semibold underline underline-offset-4"
        >
          되돌리기
        </button>
      )}
    </Box>
  );
}

function Box({ children }: { children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-2.5 rounded-xl border-2 border-ink bg-surface p-4">
      <h3 className="text-[15px] font-semibold">곡 구성 · AI 리터치</h3>
      {children}
    </section>
  );
}
