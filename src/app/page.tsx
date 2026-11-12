import Image from "next/image";
import Link from "next/link";
import { Suspense, type ReactNode } from "react";
import { Logo } from "./_components/Logo";
import mascot from "./icon.png";
import { DrumIcon, MicIcon, NoteIcon } from "./landing-icons";
import { AUTH_LINK_CLASS, LandingAuthLink } from "./LandingAuthLink";

// 랜딩. 로그인 여부를 읽는 두 자리만 요청 때 채우고, 나머지는 미리 만들어 둔 화면입니다.
// docs/specs/03_landing/design.md
export default function Home() {
  return (
    <main className="flex min-h-dvh flex-col bg-paper break-keep text-ink">
      <header className="flex items-center justify-between px-6 py-5 md:px-12">
        <Logo />
        <AuthSlot variant="header" />
      </header>

      <section className="mx-auto grid w-full max-w-[1200px] flex-1 items-center gap-10 px-6 py-10 md:grid-cols-[1fr_auto] md:px-12">
        <div>
          <h1 className="font-display text-[44px] leading-tight md:text-[64px]">
            흥얼거림을
            <br />
            밴드곡으로
          </h1>
          <p className="mt-5 max-w-[520px] text-[17px] leading-relaxed">
            떠오른 멜로디를 30초만 흥얼거려 보세요. 딕으닥이 음표로 옮기고,
            어울리는 코드와 드럼, 베이스, 건반 반주를 붙여 한 곡으로 만들어
            드려요.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/studio/new"
              className="flex min-h-[52px] items-center rounded-full border-2 border-ink bg-primary px-6 text-[17px] font-bold text-on-primary shadow-[0_4px_0_var(--color-ink)]"
            >
              바로 만들어보기
            </Link>
            <AuthSlot variant="hero" />
          </div>
          <p className="mt-5 text-[14px] text-ink-muted">
            설치도 회원가입도 없이 바로 녹음할 수 있어요. 저장할 때만 로그인하면
            돼요.
          </p>
        </div>
        <Image
          src={mascot}
          alt=""
          width={340}
          height={340}
          priority
          className="mx-auto w-[220px] md:w-[340px]"
        />
      </section>

      <section className="bg-earth px-6 pt-12 pb-8 text-surface md:px-12">
        <h2 className="sr-only">이렇게 만들어요</h2>
        <ol className="mx-auto grid max-w-[1200px] gap-5 md:grid-cols-3">
          <Step icon={<MicIcon />} title="① 흥얼거리기">
            녹음 버튼을 누르고 30초 안에 흥얼거려요. 카운트인에 맞추면 박자가 더
            정확해져요.
          </Step>
          <Step icon={<NoteIcon />} title="② 음표 고치기">
            음표로 바뀐 멜로디를 끌어서 고치고, AI가 찾은 키와 코드를 이유와
            함께 봐요.
          </Step>
          <Step icon={<DrumIcon />} title="③ 반주 붙이기">
            {/* 장르는 늘거나 바뀔 수 있어 이름을 적지 않습니다 (명세 03 §5) */}
            원하는 장르를 고르면 드럼, 베이스, 건반 반주가 붙어요. 들어 보고
            WAV로 받아요.
          </Step>
        </ol>
        <footer className="mx-auto mt-10 flex max-w-[1200px] flex-wrap justify-between gap-2 text-[13px] text-surface/80">
          <span>© 2026 딕으닥</span>
          <span>데스크톱 Chrome에서 가장 잘 동작해요</span>
        </footer>
      </section>
    </main>
  );
}

/** 로그인 여부를 확인하는 동안에는 같은 크기의 빈 칸 (회원에게 [로그인]이 잠깐 보이지 않게) */
function AuthSlot({ variant }: { variant: "header" | "hero" }) {
  return (
    <Suspense
      fallback={
        <span aria-hidden className={`${AUTH_LINK_CLASS[variant]} invisible`}>
          내 프로젝트
        </span>
      }
    >
      <LandingAuthLink variant={variant} />
    </Suspense>
  );
}

function Step({
  icon,
  title,
  children,
}: {
  icon: ReactNode;
  title: string;
  children: ReactNode;
}) {
  return (
    <li className="flex items-start gap-4 rounded-2xl border-2 border-ink bg-surface p-5 text-ink shadow-[0_4px_0_var(--color-ink)]">
      <span className="flex size-16 shrink-0 items-center justify-center rounded-full bg-paper">
        {icon}
      </span>
      <div>
        <h3 className="font-display text-[22px]">{title}</h3>
        <p className="mt-1 text-[15px] leading-relaxed text-ink-muted">
          {children}
        </p>
      </div>
    </li>
  );
}
