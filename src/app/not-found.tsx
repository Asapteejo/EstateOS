import Link from "next/link";

import { Container } from "@/components/shared/container";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <Container className="flex min-h-[60vh] items-center justify-center py-16">
      <div className="space-y-6 text-center">
        <h1 className="font-serif text-5xl text-[var(--ink-950)]">Page not found</h1>
        <p className="max-w-xl text-[var(--ink-600)]">
          The route exists in the product map, but this specific page could not be found.
        </p>
        <Link href="/">
          <Button>Go home</Button>
        </Link>
      </div>
    </Container>
  );
}
