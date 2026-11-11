import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense, type ReactNode } from "react";
import { listProjects } from "@/lib/supabase/projects";
import { createClient } from "@/lib/supabase/server";
import { Logo } from "../_components/Logo";
import mascot from "../icon.png";
import { LogoutButton } from "./LogoutButton";
import { ProjectCard } from "./ProjectCard";

// docs/specs/02_save-list/design.md §5. 사용자 확인과 목록 읽기는 Suspense 안에서 (Cache Components)
export default function ProjectsPage() {
  return (
    <main className="min-h-dvh bg-paper text-ink">
      <Suspense
        fallback={
          <>
            <Header />
            <p className="px-8 py-8 text-ink-muted">불러오는 중...</p>
          </>
        }
      >
        <Projects />
      </Suspense>
    </main>
  );
}

function Header({ account }: { account?: ReactNode }) {
  return (
    <header className="flex min-h-[65px] flex-wrap items-center gap-x-6 gap-y-2 border-b-2 border-ink bg-surface px-8 py-2">
      <Logo />
      <Link
        href="/projects"
        aria-current="page"
        className="border-b-2 border-ink py-1 font-semibold"
      >
        내 프로젝트
      </Link>
      <div className="ml-auto flex items-center gap-3">{account}</div>
    </header>
  );
}

const newProjectClass =
  "flex min-h-11 items-center rounded-full border-2 border-ink bg-primary px-5 font-bold text-on-primary shadow-[0_3px_0_var(--color-ink)]";

async function Projects() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims) redirect("/login?next=/projects");
  const projects = await listProjects(supabase, data.claims.sub);
  const email = data.claims.email ?? "";

  return (
    <>
      <Header
        account={
          <>
            <span
              aria-hidden="true"
              className="flex size-9 items-center justify-center rounded-full border-2 border-ink bg-paper font-display text-[16px] uppercase"
            >
              {email.charAt(0)}
            </span>
            <span className="hidden text-ink-muted sm:inline">{email}</span>
            <LogoutButton />
          </>
        }
      />

      <div className="px-8 py-8">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="font-display text-[40px] leading-tight">
            내 프로젝트{" "}
            <span className="font-sans text-base text-ink-muted">
              {projects.length}개
            </span>
          </h1>
          <Link href="/studio/new" className={`ml-auto ${newProjectClass}`}>
            + 새 프로젝트
          </Link>
        </div>

        {projects.length === 0 ? (
          <div className="mt-12 flex flex-col items-center gap-3 text-center">
            <Image src={mascot} alt="" width={160} height={160} />
            <p className="font-display text-[24px]">아직 만든 곡이 없어요</p>
            <p className="text-ink-muted">
              흥얼거림 한 소절이면 시작할 수 있어요
            </p>
            <Link href="/studio/new" className={`mt-2 ${newProjectClass}`}>
              새 곡 만들기
            </Link>
          </div>
        ) : (
          <ul className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {projects.map((project) => (
              <li key={project.id}>
                <ProjectCard project={project} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}
