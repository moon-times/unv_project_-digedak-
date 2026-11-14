"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import { koreanKeyName, parseKey, STYLE_LABEL } from "@/lib/music";
import type { ProjectSummary } from "@/lib/supabase/projects";
import type { Style } from "@/types/song";
import { Soon } from "../_components/Soon";
import { DeleteProjectButton } from "./DeleteProjectButton";

/** "오늘 10:42 수정" 또는 "11월 9일 수정". 사용자의 시간대 기준 */
export function updatedAtLabel(iso: string, now: Date): string {
  const at = new Date(iso);
  const sameDay = at.toDateString() === now.toDateString();
  const text = sameDay
    ? `오늘 ${at.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit", hour12: false })}`
    : at.toLocaleDateString("ko-KR", { month: "long", day: "numeric" });
  return `${text} 수정`;
}

const noSubscribe = () => () => {};

export function ProjectCard({ project }: { project: ProjectSummary }) {
  // 서버(UTC)와 사용자의 시간대가 달라 화면이 어긋나지 않도록 시각은 브라우저에서만 계산합니다.
  const updated = useSyncExternalStore(
    noSubscribe,
    () => updatedAtLabel(project.updatedAt, new Date()),
    () => "",
  );
  const key = project.key ? parseKey(project.key) : null;
  const tags = [
    key && koreanKeyName(key),
    project.style && STYLE_LABEL[project.style as Style],
    project.bpm !== null && `${project.bpm} BPM`,
  ].filter((tag): tag is string => Boolean(tag));

  return (
    <article className="relative flex flex-col gap-3 rounded-2xl border-2 border-ink bg-surface p-4 shadow-[0_4px_0_var(--color-ink)]">
      <Link
        href={`/studio/${project.id}`}
        className="text-[18px] leading-snug font-bold after:absolute after:inset-0 after:rounded-2xl"
      >
        {project.title || "제목 없는 곡"}
      </Link>
      {tags.length > 0 && (
        <ul className="flex flex-wrap gap-1.5 text-[13px]">
          {tags.map((tag) => (
            <li
              key={tag}
              className="rounded-full border border-line bg-paper px-2 py-0.5"
            >
              {tag}
            </li>
          ))}
        </ul>
      )}
      <div className="flex items-center justify-between text-[13px] text-ink-muted">
        <span>{updated}</span>
        {/* 카드 전체가 링크라 메뉴는 그 위로 올려 따로 눌리게 합니다. */}
        <details className="relative z-10 open:z-20">
          <summary
            aria-label={`${project.title || "제목 없는 곡"} 메뉴`}
            className="flex size-11 cursor-pointer list-none items-center justify-center rounded-full text-lg hover:bg-ink/10"
          >
            ···
          </summary>
          {/* 목업처럼 버튼 아래로 엽니다. 위로 열면 카드 제목 · 화면 제목을 가립니다. */}
          <div className="absolute top-full right-0 mt-1 flex w-52 flex-col rounded-xl border-2 border-ink bg-surface p-1 text-[14px] whitespace-nowrap text-ink shadow-[0_3px_0_var(--color-ink)]">
            <Link
              href={`/studio/${project.id}`}
              className="rounded-lg px-3 py-2 hover:bg-ink/10"
            >
              열기
            </Link>
            <button
              type="button"
              disabled
              className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-left text-ink-muted"
            >
              공유 링크 만들기
              <Soon />
            </button>
            <DeleteProjectButton
              id={project.id}
              title={project.title || "제목 없는 곡"}
            />
          </div>
        </details>
      </div>
    </article>
  );
}
