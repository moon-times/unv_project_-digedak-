-- projects 접근 좁히기 (코드 리뷰 반영)
-- 1. 읽기: 공유는 get_shared_project RPC로만 하기로 정했으므로(docs/01_project_overview.md §5),
--    anon 조회와 "is_public이면 누구나 읽기"를 없앱니다. 공유 RPC는 공유 기능을 만들 때 추가합니다.
-- 2. 권한: 앱이 쓰는 칸(title, song)만 쓰게 하고 id · user_id · is_public · created_at · updated_at은 막습니다.
-- 3. 크기: 계정 하나로 큰 JSON이나 긴 제목을 넣어 운영 DB를 채우지 못하게 크기를 제한합니다.

-- ── 1. 읽기: 본인 행만 ─────────────────────────
drop policy "본인 또는 공개 프로젝트 읽기" on public.projects;

create policy "본인 프로젝트 읽기"
  on public.projects for select
  to authenticated
  using ((select auth.uid()) = user_id);

-- ── 2. 권한: 기본으로 붙은 권한까지 모두 지우고 필요한 것만 다시 ──
revoke all on public.projects from anon;
revoke all on public.projects from authenticated;

grant select, delete on public.projects to authenticated;
grant insert (title, song) on public.projects to authenticated;
grant update (title, song) on public.projects to authenticated;

-- ── 3. 크기 · 형태 제한 ────────────────────────
-- 4마디 반주까지 넣은 곡이 수십 KB라 512KB면 넉넉합니다. 제목은 화면 입력도 100자로 막습니다.
alter table public.projects
  add constraint projects_song_is_object check (jsonb_typeof(song) = 'object'),
  add constraint projects_song_size check (pg_column_size(song) < 524288),
  add constraint projects_title_length check (char_length(title) <= 100);
