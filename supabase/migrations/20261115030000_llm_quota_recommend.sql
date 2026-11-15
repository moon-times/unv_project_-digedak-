-- AI 코드 재추천(명세 11)의 하루 한도를 다듬기 · 리터치와 따로 셉니다: llm_usage.kind에 'recommend' 추가.

alter table public.llm_usage drop constraint llm_usage_kind_check;
alter table public.llm_usage
  add constraint llm_usage_kind_check
  check (kind in ('polish', 'retouch', 'recommend'));

-- 한도 안이면 하나 늘리고 true, 다 썼으면 false. 허용 목록 말고는 20261115000000과 같습니다.
create or replace function public.consume_llm_quota(daily_limit int, usage_kind text default 'polish')
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
  if uid is null or daily_limit < 1 or usage_kind not in ('polish', 'retouch', 'recommend') then
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
