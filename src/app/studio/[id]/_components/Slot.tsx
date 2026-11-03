// 다른 역할의 컴포넌트가 들어갈 자리 표시
export function Slot({ label, owner }: { label: string; owner: "A" | "B" }) {
  return (
    <div className="flex h-full min-h-32 items-center justify-center rounded-lg border-2 border-dashed border-foreground/15 p-4 text-center text-sm opacity-60">
      {label}
      <br />({owner} 담당)
    </div>
  );
}
