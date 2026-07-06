"use client";

import { useMemo } from "react";

import { DataTable, type ColumnDef } from "@/components/ui/data-table";

/**
 * Client bridge for server components that hold plain string tables
 * (columns: string[], rows: string[][]) — the DataTableCard shape used by
 * Audit Logs, Documents, and Transactions. Server pages can't construct
 * TanStack ColumnDefs (cell renderers aren't serializable), so this wrapper
 * takes the serializable shape and builds index-accessor columns client-side.
 * Result: those screens get sorting / search / pagination without changing
 * how they load data.
 */
export function SimpleDataTable({
  columns,
  rows,
  searchPlaceholder,
  pageSize = 20,
  emptyTitle,
  frameless,
}: {
  columns: string[];
  rows: string[][];
  searchPlaceholder?: string;
  pageSize?: number;
  emptyTitle?: string;
  frameless?: boolean;
}) {
  const columnDefs = useMemo<ColumnDef<string[], unknown>[]>(
    () =>
      columns.map((label, index) => ({
        id: String(index),
        header: label,
        accessorFn: (row: string[]) => row[index] ?? "",
      })),
    [columns],
  );

  return (
    <DataTable<string[]>
      columns={columnDefs}
      data={rows}
      searchPlaceholder={searchPlaceholder}
      pageSize={pageSize}
      emptyTitle={emptyTitle}
      frameless={frameless}
    />
  );
}
