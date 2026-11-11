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
        onClick={() => dialog.current?.showModal()}
        className="rounded-lg px-3 py-2 text-left text-[#A23B2A] hover:bg-[#2B2018]/10"
      >
        삭제
      </button>
      <dialog
        ref={dialog}
        aria-labelledby={`delete-${id}`}
        className="m-auto w-[min(90vw,400px)] rounded-2xl border-2 border-[#2B2018] bg-[#FBF4E8] p-6 text-[#2B2018] backdrop:bg-[#2B2018]/55"
      >
        <h2 id={`delete-${id}`} className="text-[18px] font-bold">
          「{title}」을 삭제할까요?
        </h2>
        <p className="mt-2 text-[14px] text-[#5E4838]">
          삭제하면 되돌릴 수 없어요.
        </p>
        {failed && (
          <p role="alert" className="mt-2 text-[14px] text-[#A23B2A]">
            삭제하지 못했어요. 다시 시도해 주세요
          </p>
        )}
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={() => dialog.current?.close()}
            className="min-h-11 rounded-full border-2 border-[#2B2018] px-4 font-semibold"
          >
            취소
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={confirmDelete}
            className="min-h-11 rounded-full border-2 border-[#2B2018] bg-[#A23B2A] px-4 font-bold text-[#FBF4E8] disabled:opacity-50"
          >
            {pending ? "삭제하는 중..." : "삭제"}
          </button>
        </div>
      </dialog>
    </>
  );
}
