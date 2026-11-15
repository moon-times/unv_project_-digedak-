-- 프로젝트 개수 정책(20261115010000)이 projects 정책 안에서 projects를 다시 조회해,
-- Postgres가 "infinite recursion detected in policy for relation projects"(42P17)로 모든 새 프로젝트 만들기를 거절했습니다.
-- 개수는 security definer 함수로 세서 정책 안에서 RLS를 다시 타지 않게 합니다. 한도(100개)는 그대로입니다.

create function public.under_project_limit()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select count(*) < 100 from public.projects where user_id = (select auth.uid());
$$;

revoke all on function public.under_project_limit() from public, anon;
grant execute on function public.under_project_limit() to authenticated;

drop policy "본인 프로젝트 만들기" on public.projects;

create policy "본인 프로젝트 만들기"
  on public.projects for insert
  to authenticated
  with check (
    (select auth.uid()) = user_id
    and (select public.under_project_limit())
  );
