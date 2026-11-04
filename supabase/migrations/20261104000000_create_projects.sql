-- 딕으닥 프로젝트 저장 테이블과 녹음 저장소
-- 기준: docs/01_project_overview.md §5 (Supabase 테이블, Storage 버킷, RLS 정책)

-- ─────────────────────────────────────────────
-- projects: 곡 하나 = 행 하나, 곡 내용은 SongState JSON 그대로
-- ─────────────────────────────────────────────
create table public.projects (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title       text not null default '',
  song        jsonb not null,
  is_public   boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

comment on table public.projects is '사용자 프로젝트. song 컬럼에 SongState(src/types/song.ts)를 저장';

-- 내 프로젝트 목록(최근 수정 순) 조회용
create index projects_user_id_updated_at_idx on public.projects (user_id, updated_at desc);

-- updated_at 자동 갱신
create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger projects_set_updated_at
  before update on public.projects
  for each row execute function public.set_updated_at();

-- ─────────────────────────────────────────────
-- RLS: 본인 행만 읽기·쓰기, 공개(is_public) 행은 누구나 읽기
-- ─────────────────────────────────────────────
alter table public.projects enable row level security;

grant select on public.projects to anon;
grant select, insert, update, delete on public.projects to authenticated;

create policy "본인 또는 공개 프로젝트 읽기"
  on public.projects for select
  to anon, authenticated
  using (is_public or (select auth.uid()) = user_id);

create policy "본인 프로젝트 만들기"
  on public.projects for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "본인 프로젝트 수정"
  on public.projects for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "본인 프로젝트 삭제"
  on public.projects for delete
  to authenticated
  using ((select auth.uid()) = user_id);

-- ─────────────────────────────────────────────
-- Storage: recordings 버킷 (비공개), 경로는 {user_id}/{project_id}.webm
-- ─────────────────────────────────────────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'recordings',
  'recordings',
  false,
  10485760, -- 10MB (30초 녹음은 보통 1MB 미만)
  array['audio/webm', 'audio/ogg', 'audio/mp4', 'audio/wav']
)
on conflict (id) do nothing;

-- 경로의 첫 폴더가 본인 user_id일 때만 허용
create policy "본인 녹음 읽기"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'recordings' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "본인 녹음 올리기"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'recordings' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "본인 녹음 덮어쓰기"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'recordings' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'recordings' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "본인 녹음 삭제"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'recordings' and (storage.foldername(name))[1] = (select auth.uid())::text);
