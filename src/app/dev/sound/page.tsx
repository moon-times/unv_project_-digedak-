import { notFound } from "next/navigation";
import { SoundCheck } from "./SoundCheck";

// 개발 · Vercel 미리보기 전용. 실제 서비스(production 배포)에서는 404입니다.
export default function SoundCheckPage() {
  if (process.env.VERCEL_ENV === "production") notFound();
  return <SoundCheck />;
}
