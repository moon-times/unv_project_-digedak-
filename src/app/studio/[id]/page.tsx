import { Suspense } from "react";
import { Studio } from "./_components/Studio";

// /studio/new는 게스트·새 곡, 그 밖의 id는 저장된 프로젝트입니다.
export default function StudioPage({ params }: PageProps<"/studio/[id]">) {
  return (
    <Suspense
      fallback={
        <div className="p-6 text-sm text-ink-muted">스튜디오를 여는 중...</div>
      }
    >
      {params.then(({ id }) => (
        <Studio projectId={id === "new" ? null : id} />
      ))}
    </Suspense>
  );
}
