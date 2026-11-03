import Link from "next/link";

// TODO(C §3): 랜딩 화면 디자인
export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 p-8 text-center">
      <h1 className="text-4xl font-bold">딕으닥</h1>
      <p className="opacity-70">
        흥얼거린 멜로디에 밴드 반주를 붙여 곡으로 만들어 보세요.
      </p>
      <Link
        href="/studio/new"
        className="rounded-full bg-foreground px-6 py-3 font-medium text-background"
      >
        녹음 시작하기
      </Link>
    </main>
  );
}
