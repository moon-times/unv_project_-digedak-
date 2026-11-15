import type { SupabaseClient } from "@supabase/supabase-js";
import { clearRecordingDraft } from "@/lib/recordingDraft";
import { GUEST_DRAFT_KEY } from "@/store/songStore";
import type { Database } from "@/types/database";

// 계정당 프로젝트 100개 · 파일 이름 = 프로젝트 id라 한 번에 다 나옵니다 (Storage list · remove 최대 1000).
const MAX_FILES = 1000;

/**
 * 회원탈퇴 (docs/specs/13_account/design.md §4). 녹음 파일 → 계정 순서로 지웁니다.
 * 실패하면 throw하고 계정은 남습니다. 파일이 남아 있으면 사용자를 지울 수 없어서 파일이 먼저입니다.
 */
export async function deleteAccount(
  supabase: SupabaseClient<Database>,
): Promise<void> {
  // 서버에 묻는 값 (명세 01 §3: 계정 삭제처럼 지금 유효한 세션이 중요한 동작은 getUser)
  const { data, error: userError } = await supabase.auth.getUser();
  if (userError || !data.user) throw userError ?? new Error("no-user");
  const uid = data.user.id;

  const bucket = supabase.storage.from("recordings");
  const { data: files, error: listError } = await bucket.list(uid, {
    limit: MAX_FILES,
  });
  if (listError) throw listError;
  if (files.length > 0) {
    const { error } = await bucket.remove(
      files.map((file) => `${uid}/${file.name}`),
    );
    if (error) throw error;
  }

  const { error } = await supabase.rpc("delete_my_account");
  if (error) throw error;

  // 서버 세션은 이미 지워져 global 로그아웃은 실패할 수 있어 이 브라우저만 정리합니다.
  await supabase.auth.signOut({ scope: "local" }).catch(() => {});
  // 공용 기기 대비 게스트 보관본도 지웁니다 (명세 13 §6).
  try {
    localStorage.removeItem(GUEST_DRAFT_KEY);
  } catch {}
  await clearRecordingDraft().catch(() => {});
}
