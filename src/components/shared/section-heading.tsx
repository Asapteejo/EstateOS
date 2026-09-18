import { Badge } from "@/components/ui/badge";

export function SectionHeading({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  /**
   * Optional: some sections (the buyer journey) carry a heading in the CMS but
   * no supporting sentence, and inventing one here would hardcode copy that
   * tenants cannot edit.
   */
  description?: string;
}) {
  return (
    <div className="max-w-2xl space-y-4">
      <Badge>{eyebrow}</Badge>
      <div className="space-y-3">
        <h2 className="font-serif text-3xl text-[var(--ink-950)] sm:text-4xl">
          {title}
        </h2>
        {description ? (
          <p className="text-base leading-7 text-[var(--ink-600)]">{description}</p>
        ) : null}
      </div>
    </div>
  );
}
