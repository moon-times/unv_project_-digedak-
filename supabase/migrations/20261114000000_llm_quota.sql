-- LLM 호출 하루 한도 (명세 07). /api/analyze가 LLM을 부르기 전에 consume_llm_quota로 하나 차감합니다.
-- 테이블은 RLS만 켜고 정책을 두지 않아 사용자가 직접 읽거나 고칠 수 없고, RPC(security definer)로만 바뀝니다.

create table public.llm_usage (
  user_id uuid not null references auth.users (id) on delete cascade,
  day     date not null,
  count   int  not null default 0,
  primary key (user_id, day)
);

comment on table public.llm_usage is '사용자별 하루 LLM 호출 수 (한국 시간 기준 날짜)';

alter table public.llm_usage enable row level security;
revoke all on public.llm_usage from anon, authenticated;

-- 한도 안이면 하나 늘리고 true, 다 썼으면 false.
-- upsert 한 번으로 세므로 요청이 동시에 와도 한도를 넘지 않습니다.
create function public.consume_llm_quota(daily_limit int)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid   uuid := auth.uid();
  today date := (now() at time zone 'Asia/Seoul')::date;
  used  int;
begin
  if uid is null or daily_limit < 1 then
    return false;
  end if;
  insert into public.llm_usage (user_id, day, count)
  values (uid, today, 1)
  on conflict (user_id, day) do update
    set count = public.llm_usage.count + 1
    where public.llm_usage.count < daily_limit
  returning count into used;
  return used is not null;
end;
$$;

revoke all on function public.consume_llm_quota(int) from public, anon;
grant execute on function public.consume_llm_quota(int) to authenticated;
