import Link from "next/link";
import type { ReactNode } from "react";
import { Logo } from "./Logo";

/** 내 프로젝트 · 계정 화면 공통 헤더. `account`는 오른쪽 끝(이메일 · 로그아웃 등) */
export function AppHeader({
  current,
  account,
}: {
  current?: "projects";
  account?: ReactNode;
}) {
  return (
    <header className="flex min-h-[65px] flex-wrap items-center gap-x-6 gap-y-2 border-b-2 border-ink bg-surface px-8 py-2">
      <Logo />
      <Link
        href="/projects"
        aria-current={current === "projects" ? "page" : undefined}
        className="border-b-2 border-transparent py-1 font-semibold aria-[current=page]:border-ink"
      >
        내 프로젝트
      </Link>
      <div className="ml-auto flex items-center gap-3">{account}</div>
    </header>
  );
}

/** 이메일 첫 글자 원 + 이메일. 누르면 계정 화면으로 (명세 13 A2) */
export function AccountLink({ email }: { email: string }) {
  return (
    <Link
      href="/account"
      aria-label={`계정 설정 (${email})`}
      className="flex min-h-11 items-center gap-3"
    >
      <span
        aria-hidden="true"
        className="flex size-9 items-center justify-center rounded-full border-2 border-ink bg-paper font-display text-[16px] uppercase"
      >
        {email.charAt(0)}
      </span>
      <span aria-hidden="true" className="hidden text-ink-muted sm:inline">
        {email}
      </span>
    </Link>
  );
}
