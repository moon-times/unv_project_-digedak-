"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useSyncExternalStore, type SubmitEvent } from "react";
import { createClient } from "@/lib/supabase/client";
import { Soon } from "../_components/Soon";

export type Notice = "confirmed" | "link-error" | "oauth-error";
type Mode = "login" | "signup";
type Provider = "github" | "google";

// 미리보기 주소는 Supabase Redirect URLs에 없어서 OAuth가 운영으로 튕깁니다 (명세 01 보안 결정, 명세 10 R5).
const PREVIEW = process.env.NEXT_PUBLIC_VERCEL_ENV === "preview";

const NOTICE_TEXT: Record<Notice, string> = {
  // 검증값이 없는 브라우저에서는 진짜 메일 링크와 아무 code를 구분할 수 없어서 단정하지 않습니다.
  confirmed: "메일 인증을 마쳤다면 로그인해 주세요",
  "link-error": "링크가 만료됐거나 잘못됐어요. 다시 시도해 주세요",
  "oauth-error": "GitHub · Google 로그인을 마치지 못했어요. 다시 시도해 주세요",
};
const MIN_PASSWORD = 8;
const noSubscribe = () => () => {};

export function LoginForm({
  initialMode,
  next,
  notice: initialNotice,
}: {
  initialMode: Mode;
  /** safeNext()를 거친 경로 */
  next: string;
  notice: Notice | null;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>(initialMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [redirecting, setRedirecting] = useState<Provider | null>(null);
  const [socialError, setSocialError] = useState<string | null>(null);
  // 만료 링크 오류가 쿼리 대신 해시(#error=…)로 오는 경우 (서버에서는 해시를 볼 수 없음)
  const hashError = useSyncExternalStore(
    noSubscribe,
    () => window.location.hash.includes("error="),
    () => false,
  );
  // 콜백이 정한 안내(쿼리)가 먼저. OAuth 오류 해시가 따라와도 메일 링크 안내로 바꾸지 않습니다.
  const notice: Notice | null =
    initialNotice ?? (hashError ? "link-error" : null);

  const switchMode = (value: Mode) => {
    setMode(value);
    setError(null);
    setSentTo(null);
  };

  async function continueWith(provider: Provider, name: string) {
    setRedirecting(provider);
    setSocialError(null);
    const { error } = await createClient().auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}&via=oauth`,
      },
    });
    // 성공하면 브라우저가 제공자 화면으로 떠나므로 잠금을 풀지 않습니다.
    if (!error) return;
    setRedirecting(null);
    setSocialError(`지금은 ${name} 로그인을 쓸 수 없어요`);
  }

  async function onSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    if (mode === "signup" && password.length < MIN_PASSWORD) {
      setError(`비밀번호는 ${MIN_PASSWORD}자 이상이어야 해요`);
      return;
    }
    setPending(true);
    setError(null);
    const supabase = createClient();

    if (mode === "login") {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (!error) {
        router.replace(next);
        router.refresh();
        return;
      }
      setPending(false);
      setError(
        error.code === "invalid_credentials"
          ? "이메일 또는 비밀번호가 맞지 않아요"
          : error.code === "email_not_confirmed"
            ? "메일 인증을 먼저 해 주세요"
            : "로그인하지 못했어요. 잠시 뒤 다시 시도해 주세요",
      );
      return;
    }

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
      },
    });
    setPending(false);
    // 가입 여부를 드러내지 않도록 이미 가입된 이메일도 같은 안내 (명세 §3)
    if (!error || error.code === "user_already_exists") setSentTo(email);
    else setError("지금은 메일을 보낼 수 없어요. 잠시 뒤 다시 시도해 주세요");
  }

  return (
    <div className="w-full max-w-[400px]">
      <div
        role="tablist"
        className="mb-6 flex rounded-full border-2 border-ink bg-surface p-1"
      >
        {(["login", "signup"] as const).map((value) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={mode === value}
            onClick={() => switchMode(value)}
            className="min-h-11 flex-1 rounded-full text-[15px] font-semibold aria-selected:bg-ink aria-selected:text-surface"
          >
            {value === "login" ? "로그인" : "회원가입"}
          </button>
        ))}
      </div>

      <h2 className="mb-4 font-display text-[28px]">
        {mode === "login" ? "다시 오셨네요" : "처음 오셨네요"}
      </h2>

      {notice && (
        <p
          role="status"
          className="mb-4 rounded-xl border-2 border-ink bg-surface p-3 text-sm"
        >
          {NOTICE_TEXT[notice]}
        </p>
      )}

      {sentTo ? (
        <p
          role="status"
          className="rounded-xl border-2 border-ink bg-surface p-4"
        >
          확인 메일을 {sentTo}로 보냈어요. 메일의 링크를 누르면 로그인돼요. 이미
          가입했다면 로그인해 주세요.
        </p>
      ) : (
        <form onSubmit={onSubmit} className="flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <label htmlFor="login-email" className="text-sm font-semibold">
              이메일
            </label>
            <input
              id="login-email"
              type="email"
              required
              autoComplete="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={inputClass}
            />
          </div>
          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between gap-2">
              <label htmlFor="login-password" className="text-sm font-semibold">
                비밀번호
              </label>
              {mode === "login" && (
                // 비밀번호 재설정은 다음 명세
                <span className="flex items-center gap-1.5 text-xs text-ink-muted">
                  비밀번호를 잊었나요?
                  <Soon />
                </span>
              )}
            </div>
            <input
              id="login-password"
              type="password"
              required
              autoComplete={
                mode === "login" ? "current-password" : "new-password"
              }
              minLength={mode === "signup" ? MIN_PASSWORD : undefined}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              aria-describedby={error ? "login-error" : undefined}
              className={inputClass}
            />
          </div>
          {error && (
            <p id="login-error" role="alert" className="text-sm text-danger">
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={pending}
            className="mt-2 min-h-[52px] rounded-full border-2 border-ink bg-primary text-[17px] font-bold text-on-primary shadow-[0_4px_0_var(--color-ink)] disabled:opacity-50"
          >
            {pending ? "잠시만요..." : mode === "login" ? "로그인" : "가입하기"}
          </button>
        </form>
      )}

      <p className="my-5 flex items-center gap-3 text-sm text-ink-muted before:h-px before:flex-1 before:bg-line after:h-px after:flex-1 after:bg-line">
        또는
      </p>
      <div className="flex flex-col gap-2">
        {SOCIAL.map(({ provider, name, icon }) => (
          <button
            key={provider}
            type="button"
            disabled={PREVIEW || redirecting !== null}
            onClick={() => continueWith(provider, name)}
            className="flex min-h-11 items-center justify-center gap-2 rounded-full border-2 border-ink bg-surface font-semibold disabled:text-ink-muted"
          >
            {icon}
            {redirecting === provider ? "이동 중..." : `${name}로 계속하기`}
          </button>
        ))}
        {PREVIEW && (
          <p className="text-center text-sm text-ink-muted">
            미리보기에서는 이메일 로그인만 돼요
          </p>
        )}
        {socialError && (
          <p role="alert" className="text-center text-sm text-danger">
            {socialError}
          </p>
        )}
      </div>

      <p className="mt-6 text-center text-sm text-ink-muted">
        로그인 없이 먼저 해 보고 싶다면{" "}
        <Link href="/studio/new" className="font-semibold text-ink underline">
          게스트로 만들어보기
        </Link>
      </p>
    </div>
  );
}

const inputClass =
  "min-h-11 rounded-xl border-2 border-ink bg-surface px-3 text-base placeholder:text-ink-muted";

const SOCIAL: { provider: Provider; name: string; icon: React.ReactNode }[] = [
  {
    provider: "github",
    name: "GitHub",
    icon: (
      <svg
        width="18"
        height="18"
        viewBox="0 0 16 16"
        fill="currentColor"
        aria-hidden="true"
      >
        <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8z" />
      </svg>
    ),
  },
  {
    provider: "google",
    name: "Google",
    icon: (
      <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
        <path
          fill="#EA4335"
          d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
        />
        <path
          fill="#4285F4"
          d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
        />
        <path
          fill="#FBBC05"
          d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
        />
        <path
          fill="#34A853"
          d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
        />
      </svg>
    ),
  },
];
