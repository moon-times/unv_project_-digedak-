-- LLM 하루 한도를 쓰임새별로 따로 셉니다 (명세 09 §3-4).
-- 설명 다듬기([다시 분석]마다 자동)와 AI 리터치가 한 숫자를 같이 써서, 다시 분석을 많이 누르면 리터치가 막혔습니다.
-- 옛 코드처럼 daily_limit 하나만 넘겨도 'polish'로 동작하므로, 코드 배포보다 먼저 적용해도 됩니다.

alter table public.llm_usage
  add column kind text not null default 'polish'
    check (kind in ('polish', 'retouch'));

alter table public.llm_usage
  drop constraint llm_usage_pkey,
  add primary key (user_id, day, kind);

comment on table public.llm_usage is '사용자별 · 쓰임새별 하루 LLM 호출 수 (한국 시간 기준 날짜)';

drop function public.consume_llm_quota(int);

-- 한도 안이면 하나 늘리고 true, 다 썼으면 false.
-- upsert 한 번으로 세므로 요청이 동시에 와도 한도를 넘지 않습니다.
create function public.consume_llm_quota(daily_limit int, usage_kind text default 'polish')
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
  if uid is null or daily_limit < 1 or usage_kind not in ('polish', 'retouch') then
    return false;
  end if;
  insert into public.llm_usage as u (user_id, day, kind, count)
  values (uid, today, usage_kind, 1)
  on conflict (user_id, day, kind) do update
    set count = u.count + 1
    where u.count < daily_limit
  returning u.count into used;
  return used is not null;
end;
$$;

revoke all on function public.consume_llm_quota(int, text) from public, anon;
grant execute on function public.consume_llm_quota(int, text) to authenticated;
