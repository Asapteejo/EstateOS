import { Badge } from "@/components/ui/badge";

export function SectionHeading({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <div className="max-w-2xl space-y-4">
      <Badge>{eyebrow}</Badge>
      <div className="space-y-3">
        <h2 className="font-serif text-3xl text-[var(--ink-950)] sm:text-4xl">
          {title}
        </h2>
        <p className="text-base leading-7 text-[var(--ink-600)]">{description}</p>
      </div>
    </div>
  );
}
