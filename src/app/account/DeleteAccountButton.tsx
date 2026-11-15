"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { deleteAccount, SESSION_EXPIRED } from "@/lib/supabase/account";
import { createClient } from "@/lib/supabase/client";

const CONFIRM_WORD = "탈퇴";

/** 확인 대화상자 → 탈퇴 실행 (명세 13 D1 · D2 · D6 · D7) */
export function DeleteAccountButton({
  projectCount,
}: {
  projectCount: number;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [typed, setTyped] = useState("");
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState<"expired" | "error" | null>(null);

  async function confirmDelete() {
    setPending(true);
    setFailed(null);
    try {
      await deleteAccount(createClient());
      // store · 라우터 캐시까지 비우려고 전체를 새로 불러옵니다.
      window.location.replace("/?notice=account-deleted");
    } catch (error) {
      setFailed(
        error instanceof Error && error.message === SESSION_EXPIRED
          ? "expired"
          : "error",
      );
      setPending(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setTyped("");
          setFailed(null);
          dialog.current?.showModal();
        }}
        className="flex min-h-11 w-fit items-center rounded-full border-2 border-danger px-5 font-semibold text-danger"
      >
        회원탈퇴
      </button>
      <dialog
        ref={dialog}
        aria-labelledby="delete-account-title"
        className="m-auto w-[min(90vw,420px)] rounded-2xl border-2 border-ink bg-surface p-6 text-ink backdrop:bg-ink/55"
      >
        <h2 id="delete-account-title" className="text-[18px] font-bold">
          회원탈퇴할까요?
        </h2>
        <p className="mt-2 text-[14px] text-ink-muted">
          곡 {projectCount}개와 녹음, AI 사용 기록이 모두 지워지고 되돌릴 수
          없어요.
        </p>
        <label
          htmlFor="delete-account-confirm"
          className="mt-4 block text-[14px] font-semibold"
        >
          확인하려면 {CONFIRM_WORD}라고 입력해 주세요
        </label>
        <input
          id="delete-account-confirm"
          autoComplete="off"
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          className="mt-1 min-h-11 w-full rounded-xl border-2 border-ink bg-surface px-3 text-base"
        />
        {failed === "error" && (
          <p role="alert" className="mt-2 text-[14px] text-danger">
            탈퇴하지 못했어요. 다시 시도해 주세요
          </p>
        )}
        {failed === "expired" && (
          // 끊긴 세션으로는 탈퇴할 수 없어서(명세 13 D4) 새로 로그인하게 합니다.
          <p role="alert" className="mt-2 text-[14px] text-danger">
            로그인이 풀렸어요.{" "}
            <Link
              href="/login?next=/account"
              className="font-semibold underline"
            >
              다시 로그인
            </Link>
            한 뒤 시도해 주세요
          </p>
        )}
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            disabled={pending}
            onClick={() => dialog.current?.close()}
            className="min-h-11 rounded-full border-2 border-ink px-4 font-semibold disabled:opacity-50"
          >
            취소
          </button>
          <button
            type="button"
            disabled={pending || typed.trim() !== CONFIRM_WORD}
            onClick={confirmDelete}
            className="min-h-11 rounded-full border-2 border-ink bg-danger px-4 font-bold text-on-primary disabled:opacity-50"
          >
            {pending ? "탈퇴하는 중..." : "탈퇴하기"}
          </button>
        </div>
      </dialog>
    </>
  );
}
