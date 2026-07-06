"use client";

import { Dialog } from "@/components/ui/dialog";

/**
 * Quick-create modal — now a thin wrapper over the shared Dialog primitive
 * (portal to document.body, Escape/backdrop close, body scroll lock, focus
 * trap + focus restore). Kept as a named export so the quick-action call
 * sites don't change.
 */
export function QuickCreateModal({
  open,
  onClose,
  title,
  description,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <Dialog open={open} onClose={onClose} title={title} description={description} size="sm">
      {children}
    </Dialog>
  );
}
