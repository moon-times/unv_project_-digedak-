import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { listProjects } from "@/lib/supabase/projects";
import { createClient } from "@/lib/supabase/server";
import { LogoutButton } from "./LogoutButton";
import { ProjectCard } from "./ProjectCard";

// docs/specs/02_save-list/design.md §5. 사용자 확인과 목록 읽기는 Suspense 안에서 (Cache Components)
export default function ProjectsPage() {
  return (
    <main className="min-h-dvh bg-[#F3E6CF] p-8 text-[#2B2018]">
      <Suspense fallback={<p className="opacity-60">불러오는 중...</p>}>
        <Projects />
      </Suspense>
    </main>
  );
}

const newProjectClass =
  "flex min-h-11 items-center rounded-full border-2 border-[#2B2018] bg-[#2C6E62] px-5 font-bold text-[#FBF4E8] shadow-[0_3px_0_#2B2018]";

async function Projects() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims) redirect("/login?next=/projects");
  const projects = await listProjects(supabase, data.claims.sub);

  return (
    <>
      <header className="flex flex-wrap items-center gap-3">
        <h1 className="text-[28px] font-bold">
          내 프로젝트{" "}
          <span className="text-[20px] text-[#5E4838]">{projects.length}</span>
        </h1>
        <div className="ml-auto flex flex-wrap items-center gap-3">
          <span className="text-[#5E4838]">{data.claims.email}</span>
          <LogoutButton />
          <Link href="/studio/new" className={newProjectClass}>
            + 새 프로젝트
          </Link>
        </div>
      </header>

      {projects.length === 0 ? (
        <div className="mt-16 flex flex-col items-center gap-4 text-center">
          <p className="text-lg">아직 만든 곡이 없어요</p>
          <Link href="/studio/new" className={newProjectClass}>
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
    </>
  );
}
