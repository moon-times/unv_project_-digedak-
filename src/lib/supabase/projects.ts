// 프로젝트(projects 테이블) 저장 · 불러오기 · 목록 · 삭제. docs/specs/02_save-list/design.md §2
// 클라이언트를 인자로 받아 브라우저(스튜디오)와 서버(목록) 양쪽에서 씁니다. 권한은 RLS가 막습니다.
import type { SupabaseClient } from "@supabase/supabase-js";
import { SongStateSchema } from "@/lib/schemas";
import { RECORDING_EXTENSIONS } from "@/lib/supabase/recordings";
import type { Database, Json } from "@/types/database";
import type { SongState } from "@/types/song";

type Client = SupabaseClient<Database>;

/** Postgres invalid_text_representation (잘못된 uuid 문자열 등) */
const INVALID_UUID = "22P02";
/** Postgres insufficient_privilege. 로그인하지 않으면(anon) projects 권한이 없어 이 오류가 납니다. */
const NO_PRIVILEGE = "42501";

// SongState는 JSON으로 그대로 저장되는 순수 데이터라 jsonb 타입으로 바꿔 넣습니다.
const toJson = (song: SongState) => song as unknown as Json;

/** 새 프로젝트를 만들고 id를 돌려줍니다. user_id는 DB 기본값(auth.uid())이 채웁니다. */
export async function createProject(
  supabase: Client,
  song: SongState,
): Promise<string> {
  const { data, error } = await supabase
    .from("projects")
    .insert({ title: song.title, song: toJson(song) })
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}

/** 곡 전체와 제목을 저장합니다. RLS로 막히면 오류 대신 0행이 되므로 0행도 실패로 봅니다. */
export async function saveProject(
  supabase: Client,
  id: string,
  song: SongState,
): Promise<void> {
  const { data, error } = await supabase
    .from("projects")
    .update({ title: song.title, song: toJson(song) })
    .eq("id", id)
    .select("id");
  if (error) throw error;
  if (data.length === 0) throw new Error("project-not-found");
}

export type LoadResult =
  | { status: "ok"; song: SongState }
  | { status: "not-found" }
  | { status: "invalid" };

/** 없거나 내 것이 아니면 not-found, 저장된 곡이 형식 검사를 통과하지 못하면 invalid */
export async function loadProject(
  supabase: Client,
  id: string,
): Promise<LoadResult> {
  const { data, error } = await supabase
    .from("projects")
    .select("song")
    .eq("id", id)
    .maybeSingle();
  // 주소의 id가 UUID 형식이 아니거나(/studio/abc, 22P02) 로그인하지 않았으면(42501)
  // 없는 프로젝트와 같게 봅니다. 남의 프로젝트도 RLS 때문에 0행이라 not-found입니다.
  if (error?.code === INVALID_UUID || error?.code === NO_PRIVILEGE)
    return { status: "not-found" };
  if (error) throw error;
  if (!data) return { status: "not-found" };
  const parsed = SongStateSchema.safeParse(data.song);
  return parsed.success
    ? { status: "ok", song: parsed.data }
    : { status: "invalid" };
}

export type ProjectSummary = {
  id: string;
  title: string;
  updatedAt: string;
  key: string | null;
  style: string | null;
  bpm: number | null;
};

/** 목록에 보이는 최대 개수. 행마다 곡 JSON을 풀어 읽으므로 많아지면 느려집니다. */
export const LIST_LIMIT = 50;

/**
 * 내 프로젝트를 최근 수정 순으로 최대 LIST_LIMIT개와 전체 개수. 곡 전체 JSON 대신 카드에 필요한 값만 읽습니다.
 * RLS도 본인 행만 주지만, 의도를 분명히 하려고 user_id로 직접 거릅니다.
 */
export async function listProjects(
  supabase: Client,
  userId: string,
): Promise<{ projects: ProjectSummary[]; total: number }> {
  const { data, error, count } = await supabase
    .from("projects")
    .select(
      "id, title, updated_at, key:song->>key, style:song->>style, bpm:song->bpm",
      { count: "exact" },
    )
    .eq("user_id", userId)
    .order("updated_at", { ascending: false })
    .limit(LIST_LIMIT);
  if (error) throw error;
  const projects = data.map((row) => ({
    id: row.id,
    title: row.title,
    updatedAt: row.updated_at,
    key: typeof row.key === "string" ? row.key : null,
    style: typeof row.style === "string" ? row.style : null,
    bpm: typeof row.bpm === "number" ? row.bpm : null,
  }));
  return { projects, total: count ?? projects.length };
}

/**
 * 행을 먼저 지우고, 녹음 파일은 그다음에 지웁니다. 순서를 바꾸면 행 삭제가 실패했을 때 녹음만 사라집니다.
 * 녹음은 `{user id}/{project id}.{확장자}`로 정해져 있어 확장자마다 지웁니다.
 * 곡에 경로가 안 남은 파일(업로드 중 다른 곡으로 옮김)이나 다른 브라우저로 다시 녹음해 남은 예전 확장자도 함께 지워집니다.
 */
export async function deleteProject(
  supabase: Client,
  id: string,
): Promise<void> {
  const { data, error } = await supabase
    .from("projects")
    .delete()
    .eq("id", id)
    .select("id");
  if (error) throw error;
  if (data.length === 0) throw new Error("project-not-found");

  const { data: auth } = await supabase.auth.getClaims();
  const uid = auth?.claims.sub;
  if (!uid) return;
  const { error: fileError } = await supabase.storage
    .from("recordings")
    .remove(
      Object.values(RECORDING_EXTENSIONS).map((ext) => `${uid}/${id}.${ext}`),
    );
  // 파일이 남아도 목록 동작은 계속합니다. 쓰지 않는 파일 하나가 남을 뿐입니다.
  if (fileError) console.error("녹음 파일을 지우지 못했어요", fileError);
}
