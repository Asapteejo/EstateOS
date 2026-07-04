import { Building2, FileText, ShieldCheck } from "lucide-react";
import Link from "next/link";

import { Container } from "@/components/shared/container";
import { Reveal } from "@/components/shared/reveal";
import { SectionHeading } from "@/components/shared/section-heading";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

const INSIDE = [
  {
    icon: Building2,
    title: "Featured developments",
    body: "A curated look at our current and upcoming properties, with locations, layouts, and pricing guidance.",
  },
  {
    icon: ShieldCheck,
    title: "How we protect buyers",
    body: "Our verification, documentation, and payment process — so you know exactly how your money and paperwork are handled.",
  },
  {
    icon: FileText,
    title: "Payment & reservation plans",
    body: "Flexible options explained simply, including reservation windows and instalment structures.",
  },
];

export default function BrochurePage() {
  return (
    <Container className="space-y-12 py-16">
      <Reveal>
        <SectionHeading
          eyebrow="Brochure"
          title="Get the full company brochure."
          description="A clear, printable overview of our properties, process, and the safeguards that protect every buyer — ideal to share with family or advisors before you decide."
        />
      </Reveal>

      <Reveal className="grid gap-4 sm:grid-cols-3">
        {INSIDE.map((item) => (
          <Card key={item.title} className="p-6">
            <span className="flex h-11 w-11 items-center justify-center rounded-[var(--radius-md)] bg-[var(--brand-100,#dcfce7)] text-[var(--brand-700)]">
              <item.icon className="h-5 w-5" aria-hidden />
            </span>
            <h3 className="mt-4 text-lg font-semibold text-[var(--ink-950)]">{item.title}</h3>
            <p className="mt-2 text-sm leading-7 text-[var(--ink-600)]">{item.body}</p>
          </Card>
        ))}
      </Reveal>

      <Reveal>
        <Card className="flex flex-col items-start gap-4 p-8 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-xl font-semibold text-[var(--ink-950)]">Request the brochure</h3>
            <p className="mt-1 text-sm leading-7 text-[var(--ink-600)]">
              Send us a quick note and we&apos;ll email the latest brochure straight to you, along with
              availability for any property you&apos;re interested in.
            </p>
          </div>
          <Link href="/contact" className="shrink-0">
            <Button>Request brochure</Button>
          </Link>
        </Card>
      </Reveal>
    </Container>
  );
}
