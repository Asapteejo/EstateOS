import { HeartHandshake, Sparkles, TrendingUp } from "lucide-react";
import Link from "next/link";

import { Container } from "@/components/shared/container";
import { Reveal } from "@/components/shared/reveal";
import { SectionHeading } from "@/components/shared/section-heading";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

const VALUES = [
  {
    icon: TrendingUp,
    title: "Real ownership",
    body: "Small, senior team where your work ships to real buyers and sellers — not a backlog that never sees daylight.",
  },
  {
    icon: HeartHandshake,
    title: "Trust by default",
    body: "We win by making property transactions feel safe and transparent. That standard shapes how we work together too.",
  },
  {
    icon: Sparkles,
    title: "Craft that shows",
    body: "We care about the details buyers feel — clarity, speed, and follow-through — across every part of the experience.",
  },
];

export default function CareersPage() {
  return (
    <Container className="space-y-12 py-16">
      <Reveal>
        <SectionHeading
          eyebrow="Careers & Partnerships"
          title="Help us make property transactions something people trust."
          description="We're building the operating system for how homes are marketed, sold, and paid for. If that sounds like work worth doing, we'd love to hear from you."
        />
      </Reveal>

      <Reveal className="grid gap-4 sm:grid-cols-3">
        {VALUES.map((value) => (
          <Card key={value.title} className="p-6">
            <span className="flex h-11 w-11 items-center justify-center rounded-[var(--radius-md)] bg-[var(--brand-100,#dcfce7)] text-[var(--brand-700)]">
              <value.icon className="h-5 w-5" aria-hidden />
            </span>
            <h3 className="mt-4 text-lg font-semibold text-[var(--ink-950)]">{value.title}</h3>
            <p className="mt-2 text-sm leading-7 text-[var(--ink-600)]">{value.body}</p>
          </Card>
        ))}
      </Reveal>

      <Reveal>
        <Card className="flex flex-col items-start gap-4 p-8 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-xl font-semibold text-[var(--ink-950)]">No open roles right now</h3>
            <p className="mt-1 text-sm leading-7 text-[var(--ink-600)]">
              We&apos;re not actively hiring at the moment, but we always like meeting great people. Tell us
              how you&apos;d like to contribute and we&apos;ll keep you in mind.
            </p>
          </div>
          <Link href="/contact" className="shrink-0">
            <Button>Introduce yourself</Button>
          </Link>
        </Card>
      </Reveal>
    </Container>
  );
}
