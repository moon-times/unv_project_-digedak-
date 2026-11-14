-- AI 리터치 프로젝트별 횟수 (명세 08). /api/retouch가 계획을 받은 뒤에만 consume_retouch로 하나 늘립니다.
-- 테이블은 RLS만 켜고 정책을 두지 않아 사용자가 직접 읽거나 고칠 수 없고, RPC(security definer)로만 바뀝니다.
-- 횟수를 되돌리는 함수는 일부러 두지 않습니다 (사용자가 직접 불러 횟수를 되살릴 수 있으므로).

create table public.retouch_usage (
  project_id uuid primary key references public.projects (id) on delete cascade,
  count      int  not null default 0
);

comment on table public.retouch_usage is '프로젝트별 AI 리터치 사용 횟수';

alter table public.retouch_usage enable row level security;
revoke all on public.retouch_usage from anon, authenticated;

-- 내 프로젝트면 지금까지 쓴 횟수(없으면 0), 내 프로젝트가 아니거나 없으면 null.
create function public.retouch_used(target uuid)
returns int
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select u.count from public.retouch_usage u where u.project_id = p.id),
    0
  )
  from public.projects p
  where p.id = target and p.user_id = auth.uid();
$$;

-- 내 프로젝트이고 max_count보다 적게 썼으면 하나 늘리고 true, 아니면 false.
-- upsert 한 번으로 세므로 요청이 동시에 와도 max_count를 넘지 않습니다.
create function public.consume_retouch(target uuid, max_count int)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  used int;
begin
  if max_count < 1 or not exists (
    select 1 from public.projects p
    where p.id = target and p.user_id = auth.uid()
  ) then
    return false;
  end if;
  insert into public.retouch_usage (project_id, count)
  values (target, 1)
  on conflict (project_id) do update
    set count = public.retouch_usage.count + 1
    where public.retouch_usage.count < max_count
  returning count into used;
  return used is not null;
end;
$$;

revoke all on function public.retouch_used(uuid) from public, anon;
revoke all on function public.consume_retouch(uuid, int) from public, anon;
grant execute on function public.retouch_used(uuid) to authenticated;
grant execute on function public.consume_retouch(uuid, int) to authenticated;
