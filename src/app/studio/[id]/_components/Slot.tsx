// 다른 역할의 컴포넌트가 들어갈 자리 표시
export function Slot({ label, owner }: { label: string; owner: "A" | "B" }) {
  return (
    <div className="flex h-full min-h-32 items-center justify-center rounded-xl border-2 border-dashed border-line-dashed p-4 text-center text-sm text-ink-muted">
      {label}
      <br />({owner} 담당)
    </div>
  );
}
