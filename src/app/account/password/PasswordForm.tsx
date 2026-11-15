"use client";

import { useRouter } from "next/navigation";
import { useState, type SubmitEvent } from "react";
import { createClient } from "@/lib/supabase/client";

const MIN_PASSWORD = 8;

// 명세 13 P6. 대시보드 "Secure password change"가 켜져 있으면 오래된 세션은 reauthentication_needed
const ERROR_TEXT: Record<string, string> = {
  same_password: "지금 비밀번호와 달라야 해요",
  weak_password: "더 긴 비밀번호를 써 주세요",
  reauthentication_needed:
    "보안을 위해 로그아웃한 뒤 로그인 화면의 [비밀번호를 잊었나요?]로 재설정 메일을 받아 주세요",
};

export function PasswordForm() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function onSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    if (password.length < MIN_PASSWORD) {
      setError(`비밀번호는 ${MIN_PASSWORD}자 이상이어야 해요`);
      return;
    }
    if (password !== confirm) {
      setError("두 비밀번호가 같지 않아요");
      return;
    }
    setPending(true);
    setError(null);
    const { error } = await createClient().auth.updateUser({ password });
    if (error) {
      setPending(false);
      setError(
        (error.code && ERROR_TEXT[error.code]) ??
          "바꾸지 못했어요. 잠시 뒤 다시 시도해 주세요",
      );
      return;
    }
    setDone(true);
    router.replace("/projects");
    router.refresh();
  }

  if (done)
    return (
      <p
        role="status"
        className="rounded-xl border-2 border-ink bg-surface p-4"
      >
        비밀번호를 바꿨어요
      </p>
    );

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-3">
      <label htmlFor="new-password" className="text-sm font-semibold">
        새 비밀번호 (8자 이상)
      </label>
      <input
        id="new-password"
        type="password"
        required
        autoComplete="new-password"
        minLength={MIN_PASSWORD}
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        className={inputClass}
      />
      <label htmlFor="confirm-password" className="text-sm font-semibold">
        새 비밀번호 확인
      </label>
      <input
        id="confirm-password"
        type="password"
        required
        autoComplete="new-password"
        value={confirm}
        onChange={(e) => setConfirm(e.target.value)}
        aria-describedby={error ? "password-error" : undefined}
        className={inputClass}
      />
      {error && (
        <p id="password-error" role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="mt-2 min-h-[52px] rounded-full border-2 border-ink bg-primary text-[17px] font-bold text-on-primary shadow-[0_4px_0_var(--color-ink)] disabled:opacity-50"
      >
        {pending ? "잠시만요..." : "비밀번호 바꾸기"}
      </button>
    </form>
  );
}

const inputClass =
  "min-h-11 rounded-xl border-2 border-ink bg-surface px-3 text-base";
