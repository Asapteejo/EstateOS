import { Card } from "@/components/ui/card";

export function EmptyState({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <Card className="p-8 text-center">
      <h3 className="text-lg font-semibold text-[var(--ink-950)]">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-[var(--ink-600)]">{description}</p>
    </Card>
  );
}
