import Image from "next/image";
import Link from "next/link";
import mascot from "../icon.png";

/** 마스코트 + "딕으닥", `/`로 가는 링크. 글자색은 놓인 자리를 따릅니다(진갈색 면에서는 밝게). */
export function Logo({ className = "" }: { className?: string }) {
  return (
    <Link
      href="/"
      className={`flex w-fit items-center gap-2 font-display text-[22px] ${className}`}
    >
      <Image src={mascot} alt="" width={40} height={40} />
      딕으닥
    </Link>
  );
}
