"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";

import { cn } from "@/lib/utils";

export function SuperadminNavLink({
  href,
  className,
  children,
}: {
  href: string;
  className?: string;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  return (
    <Link
      href={href}
      aria-disabled={isPending}
      className={cn(className, isPending && "pointer-events-none opacity-60")}
      onClick={(event) => {
        if (isPending) {
          event.preventDefault();
          return;
        }
        event.preventDefault();
        startTransition(() => router.push(href));
      }}
    >
      {children}
    </Link>
  );
}
