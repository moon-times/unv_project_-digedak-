"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { deleteProject } from "@/lib/supabase/projects";

export function DeleteProjectButton({
  id,
  title,
  recordingPath,
}: {
  id: string;
  title: string;
  recordingPath: string | null;
}) {
  const router = useRouter();
  const dialog = useRef<HTMLDialogElement>(null);
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);

  async function confirmDelete() {
    setPending(true);
    setFailed(false);
    try {
      await deleteProject(createClient(), id, recordingPath);
      dialog.current?.close();
      router.refresh();
    } catch {
      setFailed(true);
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          // 지난번 실패 문구가 시도 전부터 보이지 않게 열 때마다 지웁니다.
          setFailed(false);
          dialog.current?.showModal();
        }}
        className="rounded-lg px-3 py-2 text-left text-danger hover:bg-ink/10"
      >
        삭제
      </button>
      <dialog
        ref={dialog}
        aria-labelledby={`delete-${id}`}
        className="m-auto w-[min(90vw,400px)] rounded-2xl border-2 border-ink bg-surface p-6 text-ink backdrop:bg-ink/55"
      >
        <h2 id={`delete-${id}`} className="text-[18px] font-bold">
          「{title}」을 삭제할까요?
        </h2>
        <p className="mt-2 text-[14px] text-ink-muted">
          삭제하면 되돌릴 수 없어요.
        </p>
        {failed && (
          <p role="alert" className="mt-2 text-[14px] text-danger">
            삭제하지 못했어요. 다시 시도해 주세요
          </p>
        )}
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={() => dialog.current?.close()}
            className="min-h-11 rounded-full border-2 border-ink px-4 font-semibold"
          >
            취소
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={confirmDelete}
            className="min-h-11 rounded-full border-2 border-ink bg-danger px-4 font-bold text-on-primary disabled:opacity-50"
          >
            {pending ? "삭제하는 중..." : "삭제"}
          </button>
        </div>
      </dialog>
    </>
  );
}
