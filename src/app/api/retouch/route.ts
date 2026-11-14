// AI 리터치. Claude에게 편곡 계획을 받아 돌려주고, 반주 음표는 브라우저 엔진이 계획대로 만듭니다.
// 입력 검증 → 로그인 → 내 프로젝트 · 남은 횟수 → 저장된 곡으로 계획 → 성공했을 때만 차감.
// docs/specs/08_llm-retouch/design.md §5
import { NextResponse } from "next/server";
import { z } from "zod";
import { DAILY_POLISH_LIMIT } from "@/app/api/analyze/route";
import { planArrangement } from "@/lib/llm/planArrangement";
import { loadProject } from "@/lib/supabase/projects";
import { createClient } from "@/lib/supabase/server";

/** 프로젝트 하나에서 리터치를 쓸 수 있는 횟수 (2026-11-14 사용자 결정) */
export const RETOUCH_LIMIT = 3;

const ProjectIdSchema = z.uuid();

type Checked =
  | { response: NextResponse }
  | { supabase: Awaited<ReturnType<typeof createClient>>; remaining: number };

/** 공통 확인: id 형식(400) · 로그인(401) · 내 프로젝트(403). 통과하면 남은 횟수 */
async function check(projectId: unknown): Promise<Checked> {
  const parsed = ProjectIdSchema.safeParse(projectId);
  if (!parsed.success)
    return {
      response: NextResponse.json(
        { error: "invalid-request" },
        { status: 400 },
      ),
    };
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  if (!auth?.claims)
    return {
      response: NextResponse.json(
        { error: "sign-in-required" },
        { status: 401 },
      ),
    };
  const { data: used, error } = await supabase.rpc("retouch_used", {
    target: parsed.data,
  });
  if (error) {
    console.error("리터치 횟수를 확인하지 못했어요", error);
    return {
      response: NextResponse.json({ error: "failed" }, { status: 500 }),
    };
  }
  if (used === null)
    return {
      response: NextResponse.json({ error: "forbidden" }, { status: 403 }),
    };
  return { supabase, remaining: Math.max(0, RETOUCH_LIMIT - used) };
}

export async function GET(request: Request) {
  const checked = await check(
    new URL(request.url).searchParams.get("projectId"),
  );
  if ("response" in checked) return checked.response;
  return NextResponse.json({ remaining: checked.remaining });
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    projectId?: unknown;
  } | null;
  const projectId = body?.projectId;
  const checked = await check(projectId);
  if ("response" in checked) return checked.response;
  const { supabase, remaining } = checked;
  if (remaining === 0)
    return NextResponse.json({ limited: true, remaining: 0 });

  // 키가 없는 환경(로컬 · 미리보기)에서는 계획을 못 만드니 하루 한도도 깎지 않습니다.
  if (!process.env.ANTHROPIC_API_KEY)
    return NextResponse.json({ error: "failed", remaining });
  // LLM을 부르기 전에 사용자별 하루 한도(설명 다듬기와 함께 씀)를 먼저 깎습니다.
  // 프로젝트 횟수는 성공한 뒤에 깎으므로, 이것이 없으면 동시 요청 · 새 프로젝트로 LLM을 끝없이 부를 수 있습니다.
  const { data: allowed, error: quotaError } = await supabase.rpc(
    "consume_llm_quota",
    { daily_limit: DAILY_POLISH_LIMIT },
  );
  if (quotaError) {
    console.error("LLM 하루 한도를 확인하지 못했어요", quotaError);
    return NextResponse.json({ error: "failed", remaining });
  }
  if (!allowed) return NextResponse.json({ dailyLimited: true, remaining });

  // 클라이언트가 보낸 곡 대신 저장된 최신 곡으로 계획합니다.
  const loaded = await loadProject(supabase, projectId as string);
  const plan =
    loaded.status === "ok" ? await planArrangement(loaded.song) : null;
  if (!plan) return NextResponse.json({ error: "failed", remaining });

  const { data: consumed, error } = await supabase.rpc("consume_retouch", {
    target: projectId as string,
    max_count: RETOUCH_LIMIT,
  });
  if (error) {
    console.error("리터치 횟수를 세지 못했어요", error);
    return NextResponse.json({ error: "failed", remaining });
  }
  // 동시에 보낸 다른 요청이 그새 마지막 횟수를 썼으면 이 계획은 버립니다.
  if (!consumed) return NextResponse.json({ limited: true, remaining: 0 });
  return NextResponse.json({ plan, remaining: remaining - 1 });
}
