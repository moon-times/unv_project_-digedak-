// 녹음 원본을 Storage recordings 버킷에 올립니다. 브라우저에서 직접 올리고 서버를 거치지 않습니다.
// docs/specs/05_recording-upload/design.md §2
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

/** 녹음 패널(A)의 pickMimeType이 고르는 형식 → 파일 확장자 */
export const RECORDING_EXTENSIONS: Record<string, string> = {
  "audio/webm": "webm",
  "audio/ogg": "ogg",
  "audio/mp4": "m4a",
};

/**
 * `{user id}/{project id}.{확장자}`에 덮어쓰고 그 경로를 돌려줍니다.
 * 경로 첫 폴더가 내 id여야 Storage 정책을 통과합니다.
 */
export async function uploadRecording(
  supabase: SupabaseClient<Database>,
  projectId: string,
  blob: Blob,
): Promise<string> {
  const { data } = await supabase.auth.getClaims();
  const uid = data?.claims.sub;
  if (!uid) throw new Error("not-signed-in");
  // Chrome은 "audio/webm;codecs=opus"처럼 주는데, 버킷 허용 목록은 기본 형식만 적혀 있습니다.
  const type = blob.type.split(";")[0] || "audio/webm";
  const path = `${uid}/${projectId}.${RECORDING_EXTENSIONS[type] ?? "webm"}`;
  const { error } = await supabase.storage
    .from("recordings")
    .upload(path, blob, { contentType: type, upsert: true });
  if (error) throw error;
  return path;
}
