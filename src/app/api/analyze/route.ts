// AI 설명 다듬기. 서버의 유일한 역할은 LLM API 키를 숨기는 것이고, 분석 값은 브라우저 규칙 엔진이 정합니다.
// 입력 검증 → 로그인 → 하루 한도 → 다듬기. 입력 오류(400) · 게스트(401) 말고는 실패해도 규칙 엔진 결과를 200으로 돌려줍니다.
// docs/specs/07_llm-explanation/design.md §4
import { NextResponse } from "next/server";
import { polishExplanation } from "@/lib/llm/polishExplanation";
import { koreanKeyName, parseKey, STYLE_LABEL } from "@/lib/music";
import { AnalyzeRequestSchema } from "@/lib/schemas";
import { createClient } from "@/lib/supabase/server";

/** 회원 한 명이 하루(한국 시간)에 다듬기를 부를 수 있는 횟수 (2026-11-14 사용자 결정) */
export const DAILY_POLISH_LIMIT = 10;

export async function POST(request: Request) {
  const parsed = AnalyzeRequestSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid-request" }, { status: 400 });
  }
  const { analysis } = parsed.data;

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  if (!auth?.claims) {
    return NextResponse.json({ error: "sign-in-required" }, { status: 401 });
  }

  const unchanged = { ...analysis, polished: false };
  const { data: allowed, error } = await supabase.rpc("consume_llm_quota", {
    daily_limit: DAILY_POLISH_LIMIT,
  });
  if (error) {
    console.error("LLM 한도를 확인하지 못했어요", error);
    return NextResponse.json(unchanged);
  }
  if (!allowed) return NextResponse.json({ ...unchanged, limited: true });

  const key = parseKey(analysis.key);
  const polished = await polishExplanation({
    explanation: analysis.explanation,
    keyName: key ? koreanKeyName(key) : analysis.key,
    chordSymbols: analysis.chords.map((chord) => chord.symbol),
    styleLabel: STYLE_LABEL[analysis.recommendedStyle],
    bpm: analysis.bpmSuggestion,
  });
  // 값(키 · 코드 · 장르 · BPM)은 요청 그대로 두고 설명만 바꿉니다.
  return NextResponse.json(
    polished
      ? { ...analysis, explanation: polished, polished: true }
      : unchanged,
  );
}
