# 명세 01: 이메일 회원가입 · 로그인

- 담당: C
- 상태: 확정 (2026-11-10, 보안 리뷰 반영)
- 근거: `docs/design/딕으닥_서비스_flow.drawio` ② 인증, `docs/design/README.md` "로그인 · 회원가입", `docs/role_C.md` §4 · §6
- 진행 방식: 이 명세를 먼저 확정하고, 아래 "작업 순서"대로 구현합니다. 구현 중 명세와 달라지는 점이 생기면 명세부터 고칩니다.

## 1. 목표

이메일과 비밀번호로 가입 · 로그인 · 로그아웃할 수 있고, 로그인한 사용자가 서버와 브라우저 양쪽에서 같은 사용자로 인식되는 상태를 만듭니다. 로그인 사용자 기준 RLS 확인(`role_C.md` §5)과 프로젝트 저장 기능이 이 상태 위에서 시작됩니다.

## 2. 범위

포함
- `/login` 화면: [로그인 | 회원가입] 탭, 이메일 · 비밀번호 입력
- 회원가입 → 확인 메일 → 링크 클릭 → 로그인 상태로 복귀
- 이메일 로그인, 로그아웃
- 로그인 뒤 원래 있던 화면으로 돌아가기 (`next` 경로)
- `/projects` 최소 화면: 로그인 사용자 이메일과 [로그아웃]만. 목록은 다음 명세
- 스튜디오 헤더: 게스트 여부를 로그인 상태로 판단, [로그인] 버튼 연결

제외 (다음 명세로)
- GitHub · Google 로그인. 원격에서 아직 꺼져 있고 OAuth 앱 등록이 먼저 필요함. 콜백 경로는 이 명세의 `/auth/callback`을 그대로 씀
- 비밀번호 재설정("비밀번호를 잊었나요?"). 화면에는 문구만 두고 비활성
- 게스트 작업 저장 · 복귀(`role_C.md` §6). 이메일 로그인은 페이지를 새로 불러오지 않으므로 store가 메모리에 남지만, 확인 메일 링크는 새 탭에서 열리므로 그 경우 게스트 작업은 이어지지 않음. `persist` 도입은 다음 명세
- 프로젝트 저장 · 목록 · 자동 저장

이미 있는 것 (이 명세에서 바꾸지 않음)
- 세션 갱신: `src/proxy.ts` → `src/lib/supabase/proxy.ts`의 `updateSession()`이 요청마다 `getClaims()`로 토큰을 갱신하고 쿠키를 다시 씀

## 3. 결정 사항

| 항목 | 결정 | 이유 |
|---|---|---|
| 로그인 경로 | `/login`, 회원가입 탭은 `/login?mode=signup` | 목업이 한 화면에 탭 두 개 |
| 이메일 중복검사 | **하지 않음.** `signUp` 결과만 쓰고, 가입된 이메일이든 아니든 같은 안내 | 따로 조회하면 가입 여부를 누구나 알아내는 창구가 됨. 원격은 메일 확인이 켜져 있어 `signUp`이 기존 이메일에도 같은 응답을 줌 |
| 비밀번호 조건 | 8자 이상. 화면에서 먼저 막고, 원격 최소 길이도 8 | 화면 검사는 우회되므로 서버 설정이 기준 |
| 메일 확인 방식 | PKCE(`@supabase/ssr` 기본). 링크 → `/auth/callback?code=…&next=…` → `exchangeCodeForSession` | 메일 템플릿을 바꾸지 않아도 됨. OAuth도 같은 콜백을 씀. 남이 만든 코드를 피해자 브라우저에 넣는 로그인 CSRF도 검증값이 맞지 않아 막힘 |
| 콜백 실패 안내 | 이 브라우저에 PKCE 검증값이 없을 때(`isAuthPKCECodeVerifierMissingError`)만 "메일 인증이 끝났어요", 나머지 실패는 "링크가 만료됐거나 잘못됐어요" | 다른 브라우저에서 링크를 열면 인증은 끝났지만 교환은 실패함. 아무 `code`로도 "인증됐어요"가 뜨면 거짓 안내 |
| 로그인 뒤 기본 이동 | `/projects` | 흐름도: 게스트 작업 없음 → 내 프로젝트 |
| 복귀 경로 검사 | `safeNext()`: 제어문자 · 백슬래시를 거부하고, URL로 파싱해 origin이 바뀌지 않는 경로만 허용 | 브라우저는 URL의 탭 · 줄바꿈을 지워서 `"/\t/evil.com"`이 `//evil.com`이 됨. 앞부분 문자열 검사만으로는 못 막음 |
| 로그인 여부 판단 | 서버는 `getClaims()`, 브라우저는 `onAuthStateChange` 구독. `getSession()`의 user는 판단에 쓰지 않음. 계정 삭제처럼 "지금 유효한 세션"이 중요한 동작은 `getUser()` | 원격은 비대칭 서명 키(ES256)라 `getClaims()`는 서명만 로컬에서 확인함. 권한의 최종 기준은 RLS |
| 로그아웃 | 브라우저 `signOut()` 기본값(`scope: "global"`, 모든 기기 로그아웃) 후 `/`로 이동 | 리프레시 토큰을 모든 기기에서 끊는 쪽이 안전. 서버 코드를 늘리지 않음 |
| 미리보기 배포 인증 | **운영 Redirect URLs에서 미리보기 와일드카드를 뺌.** 미리보기에서는 비밀번호 로그인만 확인하고, 메일 링크 흐름은 로컬 · 운영에서 확인 | vercel.app 하위 주소는 남이 프로젝트 이름으로 가져갈 수 있음. 비밀번호 재설정 · OAuth가 붙으면 그 주소로 `code`를 받아 계정을 빼앗는 공격이 가능하고 PKCE로도 막지 못함. 비밀번호 로그인은 리다이렉트가 없어 미리보기에서도 동작함 |
| 공유 링크 | **RPC 방식으로 확정.** 공유 기능을 만들 때 `projects` 읽기 정책에서 `is_public` 조건을 빼고, `get_shared_project(id)`가 `title` · `song`만 돌려줌 (조건은 10장) | 지금 정책은 공개 곡 전체를 목록으로 뽑을 수 있음. 이 명세에서는 마이그레이션을 바꾸지 않음 |

## 4. 화면 · 경로

### `/login` (`src/app/login/page.tsx`)
- 목업대로 왼쪽 진갈색 면(안내 문구 · 마스코트), 오른쪽 폼
- 탭: 로그인 / 회원가입. `mode` 쿼리로 처음 탭을 정함
- 공통 입력: 이메일(`type="email"`, `autocomplete="email"`), 비밀번호(`autocomplete="current-password"` / 가입은 `new-password`)
- [GitHub로 계속하기] [Google로 계속하기]는 보이되 비활성 (다음 명세)
- 하단 "로그인 없이 먼저 해 보고 싶다면 게스트로 만들어보기" → `/studio/new`
- 이미 로그인한 사용자가 오면 `safeNext(next)`로 보냄
- `notice` 쿼리 문구: `confirmed` = "메일 인증을 마쳤다면 로그인해 주세요" (검증값이 없는 브라우저에서는 진짜 링크와 아무 `code`를 구분할 수 없어 단정하지 않음, 구현 중 수정), `link-error` = "링크가 만료됐거나 잘못됐어요. 다시 시도해 주세요"
- 주소 해시에 `#error=…`가 붙어 오면 `link-error` 문구를 보여 줌 (만료 링크 오류가 쿼리 대신 해시로 오는 경우 대비. 실제 만료 링크로 확인 후 필요 없으면 뺌)

### `/auth/callback` (`src/app/auth/callback/route.ts`, Route Handler)
1. `error` 쿼리가 있거나 `code`가 없으면 → `/login?notice=link-error`
2. `code`로 `exchangeCodeForSession`
3. 성공 → `safeNext(next)`로 리다이렉트. origin은 `request.nextUrl.origin` (Host 헤더를 직접 조합하지 않음)
4. 실패
   - `isAuthPKCECodeVerifierMissingError(error)` (`@supabase/supabase-js`) → `/login?notice=confirmed`
   - 그 밖의 오류 → `/login?notice=link-error`

### `/projects` (`src/app/projects/page.tsx`, 최소 화면)
- 서버에서 `getClaims()`로 사용자 확인. 없으면 `/login?next=/projects`로 `redirect`
- Cache Components 규칙상 사용자 정보를 읽는 부분은 `<Suspense>` 안에 둠 (`node_modules/next/dist/docs/01-app/02-guides/authentication-with-cache-components.md`)
- 표시: "내 프로젝트", 로그인 이메일, [로그아웃], [새 곡 만들기] → `/studio/new`

### 스튜디오 헤더 (`src/app/studio/[id]/_components/Studio.tsx`)
- `isGuest`를 `projectId === null`에서 "로그인 사용자 없음"으로 바꿈 (`TODO(C §4)` 해소)
- [로그인] 버튼 → `/login?next=/studio/{현재 id}` 링크
- 내보내기 팝업은 이 명세 범위 밖

## 5. 동작 명세

### 회원가입
- 입력 검사(화면): 이메일 형식, 비밀번호 8자 이상. 통과 못 하면 요청하지 않고 입력칸 아래에 이유 표시
- `signUp({ email, password, options: { emailRedirectTo } })`. `emailRedirectTo`는 `${location.origin}/auth/callback?next=${encodeURIComponent(safeNext(next))}`로, 메일 링크에 넣기 전에 `safeNext`로 거름
- 결과와 상관없이(이미 가입된 이메일 포함) "확인 메일을 {email}로 보냈어요. 메일의 링크를 누르면 로그인돼요. 이미 가입했다면 로그인해 주세요" 안내로 바뀜
- 예외: 네트워크 오류 · 요청 한도 초과(`over_email_send_rate_limit`)만 "지금은 메일을 보낼 수 없어요. 잠시 뒤 다시 시도해 주세요"
- 요청 중에는 버튼 비활성, 중복 제출 막음

### 로그인
- `signInWithPassword({ email, password })`
- 성공 → `router.replace(safeNext(next))` 후 `router.refresh()` (서버 컴포넌트가 새 쿠키로 다시 그려지도록)
- `invalid_credentials` → "이메일 또는 비밀번호가 맞지 않아요" (어느 쪽이 틀렸는지 구분하지 않음)
- `email_not_confirmed` → "메일 인증을 먼저 해 주세요" (비밀번호가 맞을 때만 나오는 오류라 가입 여부를 새로 드러내지 않음)
- 그 밖의 오류 → "로그인하지 못했어요. 잠시 뒤 다시 시도해 주세요"

### 로그아웃
- `signOut()` → `router.replace("/")` → `router.refresh()`
- 재생 중이던 소리는 스튜디오를 벗어나며 멈춤 (`useSyncPlayerWithSong` 정리 함수)

### 로그인 상태 공유 (브라우저)
- `src/lib/supabase/useAuthUser.ts`: `getUser()`로 처음 값을 읽고 `onAuthStateChange`로 갱신. 반환 `{ user: User | null, loading: boolean }`
- 다른 탭에서 로그아웃하면 이 탭 헤더도 게스트 표시로 바뀜

## 6. 코드 인터페이스

```ts
// src/lib/auth/redirect.ts
export const DEFAULT_AFTER_LOGIN = "/projects";
/** 로그인 뒤 이동할 경로. 앱 안의 상대 경로만 통과시키고 나머지는 기본값 */
export function safeNext(next: string | null | undefined): string;
```

구현 방식
1. 비었거나 `/`로 시작하지 않거나 `//`로 시작하면 기본값
2. 제어문자(`\u0000`~`\u001F`, `\u007F`)나 `\`가 어디든 있으면 기본값
3. `new URL(next, "http://internal.invalid")`로 파싱해 origin이 그대로일 때만 `pathname + search + hash`를 돌려줌. 파싱 실패는 기본값
4. 결과 경로가 `/login`이나 `/auth/`로 시작하면 기본값 (로그인 화면으로 되돌아가는 반복 방지)

`safeNext`를 거치는 곳: `/auth/callback` 리다이렉트, 로그인 성공 뒤, 이미 로그인한 사용자를 `/login`에서 보낼 때, `emailRedirectTo`를 만들 때

판정 (테스트로 고정):

| 입력 | 결과 |
|---|---|
| `"/studio/new"`, `"/projects?x=1"` | 그대로 |
| `"/%0A/evil.com"` | 그대로 (인코딩된 문자는 경로로 남음) |
| `null`, `""`, `"projects"` | `/projects` |
| `"//evil.com"`, `"/\\evil.com"`, `"https://evil.com"`, `"javascript:alert(1)"` | `/projects` |
| `"/\t/evil.com"`, `"/\n/evil.com"`, `"/\\/evil.com"` | `/projects` |
| `"/login"`, `"/login?next=/x"`, `"/auth/callback"` | `/projects` |

## 7. 원격 Supabase 설정

2026-11-10에 공개 API로 확인한 값:
- 메일 확인: 켜짐 (`/auth/v1/settings`의 `mailer_autoconfirm: false`)
- 가입 허용: 켜짐
- 익명 로그인: 꺼짐. 이대로 유지 (켜면 익명 사용자도 `projects`에 쓸 수 있음)
- 외부 로그인: 이메일만 켜짐. GitHub · Google 꺼짐
- JWT 서명 키: 비대칭 ES256 (`/auth/v1/.well-known/jwks.json`)

대시보드 설정 (사용자 작업):
- [x] Site URL: `https://unvproject-digedak-dicgedak.vercel.app/` (2026-11-10 확인)
- [x] Redirect URLs: `http://localhost:3000/**`, `https://unvproject-digedak-dicgedak.vercel.app/**` 두 개만 (미리보기 와일드카드 삭제, 2026-11-10 사용자 확인)
- [x] 비밀번호 최소 길이 8 (2026-11-10 확인)
- [x] 메일 발송: 커스텀 SMTP 꺼짐, 기본 메일 서버 사용 (2026-11-10 확인). 개발 중 팀원 메일로 시험하는 데는 충분

팀원 외 사용자에게 가입을 열기 전에 (이 명세 완료 조건은 아님):
- [ ] 커스텀 SMTP 설정
- [ ] CAPTCHA (Turnstile 또는 hCaptcha). Supabase Auth 설정에서 켜고 `signUp` · `signInWithPassword`에 `captchaToken` 전달. 남의 이메일로 가입 요청을 반복해 메일을 쏟아붓거나 발송 한도를 소진시키는 것을 막음
- [ ] 대시보드 Rate limits 값 검토

저장소 쪽 맞춤:
- `supabase/config.toml`: `enable_confirmations = true`, `additional_redirect_urls`의 `https://127.0.0.1:3000` → `http://127.0.0.1:3000/**` (로컬 개발을 원격과 같게)

### 테스트 계정

원격 DB가 운영 DB 하나뿐이라, 로그인 확인용 계정은 만들기 전에 사용자에게 확인합니다. 메일 확인이 켜져 있어 실제로 받을 수 있는 주소가 필요합니다.

### 알려진 한계

- 가입 안내 문구는 같지만, 새 이메일은 메일을 보내고 이미 인증된 이메일은 보내지 않아 응답 시간이 다를 수 있음. 발송 한도 오류도 새 이메일에서만 남. 감수함
- 로그아웃한 세션의 액세스 토큰도 만료 전(기본 1시간)까지는 서버 `getClaims()`가 유효로 봄. 표시 용도라 감수하고, 중요한 동작은 `getUser()`를 씀
- `@supabase/ssr` 세션 쿠키는 브라우저 클라이언트가 읽어야 해서 HttpOnly가 아님. XSS가 있으면 세션을 빼앗김 (10장 공유 기능 조건)

## 8. 완료 기준

- [x] `safeNext` 단위 테스트 통과 (6장 표 전부)
- [x] 회원가입 → 메일 링크 → `/projects`에 로그인 이메일이 보임 (같은 브라우저)
- [ ] 다른 브라우저에서 메일 링크를 열면 `/login`에 "메일 인증을 마쳤다면 로그인해 주세요" 안내
- [ ] `/auth/callback?code=아무값`: 가입한 브라우저(검증값 있음)에서는 "링크가 만료됐거나 잘못됐어요", 검증값 없는 브라우저에서는 "메일 인증을 마쳤다면 로그인해 주세요"
- [ ] 만료되거나 이미 쓴 메일 링크를 열면 "링크가 만료됐거나 잘못됐어요" 안내 (오류가 쿼리로 오는지 해시로 오는지 기록)
- [ ] 이미 가입된 이메일로 가입해도 처음 가입과 같은 안내가 나옴
- [x] 틀린 비밀번호 → "이메일 또는 비밀번호가 맞지 않아요"
- [x] 로그아웃 후 `/projects` 접근 → `/login?next=/projects`
- [ ] 스튜디오에서 [로그인] → 로그인 → 같은 스튜디오로 복귀, 헤더가 회원 표시로 바뀜
- [x] RLS (`role_C.md` §5 남은 확인): 로그인한 상태에서 남의 `user_id`로 `projects` insert → 거부, 남의 프로젝트 select · update · delete → 0행. 로그아웃 상태(anon)에서 insert → 거부 (2026-11-10 확인: 남의 user_id insert 403/42501, 내 행 user_id 변경 403/42501, anon insert 401/42501, 남의 행 update · delete 0행. 단 다른 사용자의 행이 아직 없어 0행 결과는 두 번째 계정으로 다시 확인 필요)
- [ ] Vercel 미리보기에서 비밀번호 로그인 · 로그아웃 동작
- [ ] `npm run typecheck`, `lint`, `test:run`, `format:check` 통과

## 9. 작업 순서

1. `safeNext` + 테스트
2. `/auth/callback` Route Handler
3. `useAuthUser` 훅
4. `/login` 화면 (로그인 탭 → 회원가입 탭)
5. `/projects` 최소 화면 + 로그아웃
6. 스튜디오 헤더 연결
7. `config.toml` 맞춤, 대시보드 Redirect URLs 정리 (7장 체크리스트)
8. 완료 기준 확인 (테스트 계정은 사용자 확인 후)

## 10. 다음 명세로 넘기는 보안 조건

공유 기능 명세 (선행 조건)
- `get_shared_project(id)`: `security definer` + `set search_path = ''`, 함수 안에서 `is_public`을 직접 확인, `public`에서 실행 권한을 회수하고 `anon` · `authenticated`에만 부여. 프로젝트 id는 지금처럼 UUID
- 운영 DB에는 "공개 곡 전체 목록 조회 가능" 정책이 이미 적용돼 있음(2026-11-04). 공유 UI를 열기 전에 정책부터 바꿈
- 사용자가 만든 내용(제목, 곡 데이터)을 남에게 보여 주므로 XSS 방어를 먼저 갖춤: CSP 헤더(`script-src` 제한, `frame-ancestors 'none'`), `dangerouslySetInnerHTML` 금지 lint 규칙
- DB에서 불러온 곡은 `SongStateSchema.safeParse`를 통과한 뒤에만 store와 재생기에 넘김 (악기 이름에 URL을 넣는 경우 등)

비밀번호 재설정 · OAuth 명세
- 미리보기 배포에서 메일 링크 · OAuth를 시험하려면 운영이 아닌 개발용 Supabase 프로젝트나 branching을 씀. 운영 Redirect URLs에 vercel.app 와일드카드를 다시 넣지 않음
