-- 회원탈퇴 (docs/specs/13_account/design.md §4). 지금 요청한 세션의 사용자 계정을 지웁니다.
-- projects · llm_usage(FK cascade), retouch_usage(projects cascade), identities · sessions가 같이 지워집니다.
-- 녹음 파일은 Storage API로만 지워야 하고(SQL로 지우면 실제 파일이 남음), 파일이 남아 있으면 사용자를 지울 수 없어
-- 브라우저가 이 함수를 부르기 전에 지웁니다.

create function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- 로그아웃한 세션의 토큰(만료 전까지 서명은 유효)으로는 지우지 못하게, 살아 있는 세션인지 확인합니다.
  if auth.uid() is null or not exists (
    select 1 from auth.sessions
    where id = (auth.jwt() ->> 'session_id')::uuid
      and user_id = auth.uid()
  ) then
    raise exception 'no active session' using errcode = '42501';
  end if;

  delete from auth.users where id = auth.uid();
end;
$$;

revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
