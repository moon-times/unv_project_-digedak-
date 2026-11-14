-- 계정 하나가 DB · 스토리지를 채우지 못하게 개수를 막습니다 (명세 09 §3-3).
-- 1. 프로젝트: 계정당 100개까지 (행 하나가 512KB까지라 최대 약 50MB)
-- 2. 녹음: 파일 이름이 내 프로젝트 id일 때만 올리기 · 덮어쓰기 · 이름 바꾸기
--    (지금까지는 첫 폴더만 내 id면 어떤 이름이든 10MB씩 끝없이 올릴 수 있었습니다)

-- ── 1. 프로젝트 개수 ───────────────────────────
drop policy "본인 프로젝트 만들기" on public.projects;

-- 안쪽 조회에도 "본인 프로젝트 읽기" 정책이 걸려 내 행만 셉니다.
create policy "본인 프로젝트 만들기"
  on public.projects for insert
  to authenticated
  with check (
    (select auth.uid()) = user_id
    and (select count(*) from public.projects p where p.user_id = (select auth.uid())) < 100
  );

-- ── 2. 녹음 파일 이름 = 내 프로젝트 id ──────────
drop policy "본인 녹음 올리기" on storage.objects;
drop policy "본인 녹음 덮어쓰기" on storage.objects;

create policy "본인 녹음 올리기"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'recordings'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and exists (
      select 1 from public.projects p
      where p.user_id = (select auth.uid())
        and p.id::text = split_part(storage.filename(name), '.', 1)
    )
  );

create policy "본인 녹음 덮어쓰기"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'recordings' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (
    bucket_id = 'recordings'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and exists (
      select 1 from public.projects p
      where p.user_id = (select auth.uid())
        and p.id::text = split_part(storage.filename(name), '.', 1)
    )
  );
