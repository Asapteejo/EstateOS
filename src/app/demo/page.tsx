import Link from "next/link";

import { DealBoardView } from "@/components/admin/deal-board-view";
import { PlatformFooter } from "@/components/platform/platform-footer";
import { PlatformHeader } from "@/components/platform/platform-header";
import { Container } from "@/components/shared/container";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { getPublicDemoWorkspace } from "@/modules/demo/workspace";

export default async function DemoPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const inspect = params.inspect === "1";
  const demo = getPublicDemoWorkspace();

  return (
    <div className="min-h-screen bg-[var(--sand-50)]">
      <PlatformHeader />
      <main className="space-y-10 pb-20 pt-10">
        <Container className="space-y-8">
          <Card className="overflow-hidden bg-[linear-gradient(135deg,#07131a,#10343f_42%,#d7b98f_145%)] px-8 py-10 text-white sm:px-10 sm:py-12">
            <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
              <div className="space-y-5">
                <div className="flex flex-wrap items-center gap-3">
                  <Badge className="bg-white/12 text-white">Demo workspace</Badge>
                  <span className="text-xs font-semibold uppercase tracking-[0.18em] text-white/65">
                    Read-only preview
                  </span>
                </div>
                <div className="space-y-4">
                  <h1 className="max-w-4xl font-serif text-4xl leading-tight sm:text-6xl">
                    See how EstateOS runs deals, payments, and collections for a developer sales team.
                  </h1>
                  <p className="max-w-3xl text-base leading-8 text-white/80 sm:text-lg">
                    This is a sample developer workspace. It shows the real operating loop inside
                    EstateOS: deals coming in, payment requests being sent, overdue collections being
                    worked, and revenue staying visible.
                  </p>
                </div>
                <div className="flex flex-wrap gap-3">
                  <Link href="/app/onboarding">
                    <Button size="lg">Start your workspace</Button>
                  </Link>
                  <Link href="/platform/pricing">
                    <Button size="lg" variant="secondary">
                      See pricing
                    </Button>
                  </Link>
                </div>
              </div>

              <div className="grid gap-3">
                {demo.narrative.map((item, index) => (
                  <Card key={item.title} className="bg-white/8 p-5 text-white backdrop-blur">
                    <div className="text-xs font-semibold uppercase tracking-[0.18em] text-white/60">
                      Step {index + 1}
                    </div>
                    <div className="mt-2 text-lg font-semibold">{item.title}</div>
                    <p className="mt-2 text-sm leading-7 text-white/78">{item.body}</p>
                  </Card>
                ))}
              </div>
            </div>
          </Card>

          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
            <Card className="rounded-[30px] border-[var(--line)] bg-white p-5 sm:p-6">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--ink-500)]">
                    {demo.company.name}
                  </div>
                  <h2 className="mt-2 text-2xl font-semibold text-[var(--ink-950)]">
                    Developer sales workspace preview
                  </h2>
                  <p className="mt-2 max-w-3xl text-sm leading-7 text-[var(--ink-600)]">
                    Explore a realistic board with active deals, payment requests, and overdue
                    collections. Actions are intentionally read-only here.
                  </p>
                </div>
                <div className="flex flex-wrap gap-3">
                  <Link href={inspect ? "/demo" : "/demo?inspect=1"}>
                    <Button variant="outline">{inspect ? "Hide structure labels" : "Inspect structure"}</Button>
                  </Link>
                  <Link href="/app/onboarding">
                    <Button>Get Started</Button>
                  </Link>
                </div>
              </div>
            </Card>

            <Card className="rounded-[30px] border-[var(--line)] bg-[var(--sand-50)] p-5">
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--ink-500)]">
                What this shows
              </div>
              <div className="mt-3 space-y-3 text-sm leading-7 text-[var(--ink-700)]">
                <div>Deals moving from new leads to payment and collections.</div>
                <div>Payment requests sitting directly inside the revenue workflow.</div>
                <div>Overdue buyers surfaced with follow-up state and collections priority.</div>
              </div>
            </Card>
          </div>

          <DealBoardView
            board={demo.board}
            mode="demo"
            inspect={inspect}
            demoCtaHref="/app/onboarding"
          />

          <Card className="rounded-[32px] bg-[linear-gradient(135deg,#0f1a23,#174b4d)] px-8 py-10 text-white">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
              <div className="max-w-2xl">
                <div className="text-xs font-semibold uppercase tracking-[0.22em] text-white/65">
                  Launch your own workspace
                </div>
                <h3 className="mt-3 text-3xl font-semibold">
                  Stop tracking deals, bank transfers, and follow-up in scattered tools.
                </h3>
                <p className="mt-3 text-sm leading-7 text-white/78">
                  EstateOS gives developer sales teams one system for deals, buyer payments, and
                  collections visibility.
                </p>
              </div>
              <div className="flex flex-wrap gap-3">
                <Link href="/app/onboarding">
                  <Button size="lg">Create your workspace</Button>
                </Link>
                <Link href="/platform/how-it-works">
                  <Button size="lg" variant="secondary">
                    See how it works
                  </Button>
                </Link>
              </div>
            </div>
          </Card>
        </Container>
      </main>
      <PlatformFooter />
    </div>
  );
}
