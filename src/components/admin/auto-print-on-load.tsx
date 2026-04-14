"use client";

import { useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";

export function AutoPrintOnLoad({ title }: { title: string }) {
  const searchParams = useSearchParams();
  const hasPrintedRef = useRef(false);

  useEffect(() => {
    if (searchParams.get("export") !== "pdf" || hasPrintedRef.current) {
      return;
    }

    hasPrintedRef.current = true;
    const previousTitle = document.title;
    document.title = title;

    const timer = window.setTimeout(() => {
      window.print();
      document.title = previousTitle;
    }, 250);

    return () => {
      window.clearTimeout(timer);
      document.title = previousTitle;
    };
  }, [searchParams, title]);

  return null;
}
