import { Container } from "@/components/shared/container";

function Pulse({ className }: { className: string }) {
  return <div className={`animate-pulse rounded-md bg-[var(--sand-100)] ${className}`} />;
}

export function SuperadminLoading() {
  return (
    <Container className="grid gap-6 py-8 lg:grid-cols-[280px_1fr]">
      <aside className="space-y-4 rounded-[28px] border border-[var(--line)] bg-white p-5">
        <Pulse className="h-40 w-full" />
        {[1, 2, 3, 4, 5, 6].map((item) => <Pulse key={item} className="h-11 w-full" />)}
      </aside>
      <div className="space-y-6">
        <Pulse className="h-12 w-72" />
        <Pulse className="h-5 w-full max-w-2xl" />
        <div className="grid gap-4 md:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((item) => <Pulse key={item} className="h-28 w-full" />)}
        </div>
        <Pulse className="h-80 w-full" />
      </div>
    </Container>
  );
}
