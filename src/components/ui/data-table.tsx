"use client";

import { useMemo, useState } from "react";
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
} from "@tanstack/react-table";

import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/**
 * Shared data table built on TanStack Table (headless), the replacement for
 * the bespoke `<table>` implementations across the admin screens. One
 * consistent look (tokens, sticky header, hover states) and one consistent
 * behavior set (client-side sorting, optional search, optional pagination)
 * instead of sixteen slightly different ones.
 *
 * Usage:
 *   const columns: ColumnDef<Row>[] = [
 *     { accessorKey: "name", header: "Name" },
 *     { accessorKey: "status", header: "Status", cell: ({ row }) => <Badge>…</Badge> },
 *   ];
 *   <DataTable columns={columns} data={rows} searchPlaceholder="Search clients…" />
 *
 * Server-driven tables (very large datasets) should keep their own pagination
 * and pass `pageSize={0}` to disable client paging.
 */
export function DataTable<TData>({
  columns,
  data,
  searchPlaceholder,
  pageSize = 20,
  emptyTitle = "Nothing here yet",
  emptyDescription,
  onRowClick,
  className,
  frameless = false,
}: {
  columns: ColumnDef<TData, unknown>[];
  data: TData[];
  /** When set, renders a search input that filters across all columns. */
  searchPlaceholder?: string;
  /** Rows per page for client-side pagination. Pass 0 to disable paging. */
  pageSize?: number;
  emptyTitle?: string;
  emptyDescription?: string;
  onRowClick?: (row: TData) => void;
  className?: string;
  /**
   * Drops the table's own border/radius/shadow chrome, for embedding inside
   * an existing Card (e.g. DataTableCard) without double borders.
   */
  frameless?: boolean;
}) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = useState("");

  const paginationEnabled = pageSize > 0;
  const initialState = useMemo(
    () => (paginationEnabled ? { pagination: { pageSize } } : undefined),
    [paginationEnabled, pageSize],
  );

  const table = useReactTable({
    data,
    columns,
    state: { sorting, globalFilter },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    ...(paginationEnabled ? { getPaginationRowModel: getPaginationRowModel() } : {}),
    initialState,
  });

  const rows = table.getRowModel().rows;
  const totalRows = table.getFilteredRowModel().rows.length;

  /**
   * Column label for the phone card layout. Header definitions are usually
   * plain strings; anything else (a custom header renderer) is rendered
   * through flexRender so the card shows the same label as the table head.
   */
  const headerLabelFor = (columnId: string) => {
    const header = table
      .getHeaderGroups()
      .at(-1)
      ?.headers.find((candidate) => candidate.column.id === columnId);
    if (!header || header.isPlaceholder) {
      return null;
    }
    const definition = header.column.columnDef.header;
    return typeof definition === "string"
      ? definition
      : flexRender(definition, header.getContext());
  };

  return (
    <div className={cn("min-w-0", className)}>
      {searchPlaceholder ? (
        <div className={cn("mb-4 max-w-sm", frameless && "px-5 pt-4")}>
          <Input
            type="search"
            value={globalFilter}
            onChange={(event) => setGlobalFilter(event.target.value)}
            placeholder={searchPlaceholder}
            aria-label={searchPlaceholder}
          />
        </div>
      ) : null}

      {/* Phone layout: one card per row. A table narrower than the viewport is
          unreadable on a phone, these screens were 775-973px wide inside a
          333px column, i.e. three screens of sideways scrolling. The first
          column becomes the card heading and the rest become label/value
          pairs, so the same columns stay legible in a single vertical scroll.
          The real table takes over from `md` up. */}
      <div className="space-y-3 md:hidden">
        {rows.length === 0 ? (
          <div
            className={cn(
              "px-4 py-10 text-center",
              !frameless &&
                "rounded-[var(--radius-lg)] border border-[var(--line)] bg-[var(--surface)]",
            )}
          >
            <div className="text-sm font-medium text-[var(--ink-700)]">{emptyTitle}</div>
            {emptyDescription ? (
              <div className="mt-1 text-sm text-[var(--ink-500)]">{emptyDescription}</div>
            ) : null}
          </div>
        ) : (
          rows.map((row) => {
            const [primaryCell, ...detailCells] = row.getVisibleCells();
            return (
              <div
                key={row.id}
                {...(onRowClick
                  ? {
                      role: "button",
                      tabIndex: 0,
                      onClick: () => onRowClick(row.original),
                      onKeyDown: (event: React.KeyboardEvent<HTMLDivElement>) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          onRowClick(row.original);
                        }
                      },
                    }
                  : {})}
                className={cn(
                  "rounded-[var(--radius-lg)] border border-[var(--line)] bg-[var(--surface)] p-4 shadow-[var(--shadow-xs)]",
                  onRowClick && "admin-focus cursor-pointer",
                )}
              >
                {primaryCell ? (
                  <div className="text-base font-semibold text-[var(--ink-950)]">
                    {flexRender(primaryCell.column.columnDef.cell, primaryCell.getContext())}
                  </div>
                ) : null}
                {detailCells.length > 0 ? (
                  <dl className="mt-3 space-y-2">
                    {detailCells.map((cell) => (
                      <div key={cell.id} className="flex items-start justify-between gap-3">
                        <dt className="shrink-0 text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--ink-500)]">
                          {headerLabelFor(cell.column.id)}
                        </dt>
                        <dd className="min-w-0 text-right text-sm text-[var(--ink-800)]">
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </dd>
                      </div>
                    ))}
                  </dl>
                ) : null}
              </div>
            );
          })
        )}
      </div>

      <div
        className={cn(
          "hidden overflow-x-auto md:block",
          !frameless &&
            "rounded-[var(--radius-lg)] border border-[var(--line)] bg-[var(--surface)] shadow-[var(--shadow-xs)]",
        )}
      >
        <table className="w-full border-collapse text-sm">
          <thead className="sticky top-0 z-10 bg-[var(--sand-50)]">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id} className="border-b border-[var(--line)]">
                {headerGroup.headers.map((header) => {
                  const sortable = header.column.getCanSort();
                  const sortDirection = header.column.getIsSorted();
                  return (
                    <th
                      key={header.id}
                      scope="col"
                      aria-sort={
                        sortDirection === "asc"
                          ? "ascending"
                          : sortDirection === "desc"
                            ? "descending"
                            : undefined
                      }
                      className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--ink-500)]"
                    >
                      {header.isPlaceholder ? null : sortable ? (
                        <button
                          type="button"
                          onClick={header.column.getToggleSortingHandler()}
                          // -my-2 py-2 keeps the header's visual height while
                          // giving the sort control a 32px+ hit area (it was 16px).
                          className="admin-focus -my-2 inline-flex min-h-8 items-center gap-1.5 rounded-[var(--radius-sm)] py-2 hover:text-[var(--ink-900)]"
                        >
                          {flexRender(header.column.columnDef.header, header.getContext())}
                          <span aria-hidden="true" className="text-[var(--ink-400)]">
                            {sortDirection === "asc" ? "↑" : sortDirection === "desc" ? "↓" : "↕"}
                          </span>
                        </button>
                      ) : (
                        flexRender(header.column.columnDef.header, header.getContext())
                      )}
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-4 py-12 text-center">
                  <div className="text-sm font-medium text-[var(--ink-700)]">{emptyTitle}</div>
                  {emptyDescription ? (
                    <div className="mt-1 text-sm text-[var(--ink-500)]">{emptyDescription}</div>
                  ) : null}
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr
                  key={row.id}
                  onClick={onRowClick ? () => onRowClick(row.original) : undefined}
                  className={cn(
                    "border-b border-[var(--line)] last:border-b-0",
                    onRowClick &&
                      "cursor-pointer transition-colors duration-[var(--duration-fast)] hover:bg-[var(--sand-50)]",
                  )}
                >
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className="px-4 py-3 align-middle text-[var(--ink-700)]">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {paginationEnabled && totalRows > pageSize ? (
        <div
          className={cn(
            "mt-3 flex flex-wrap items-center justify-between gap-3 text-sm text-[var(--ink-500)]",
            frameless && "px-5 pb-4",
          )}
        >
          <span>
            {totalRows} row{totalRows === 1 ? "" : "s"} · page {table.getState().pagination.pageIndex + 1} of{" "}
            {table.getPageCount()}
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
              className="admin-interactive admin-focus h-11 rounded-[var(--radius-md)] border border-[var(--line)] bg-white px-4 font-medium sm:h-9 sm:px-3 text-[var(--ink-700)] hover:bg-[var(--sand-100)] disabled:cursor-not-allowed disabled:opacity-50"
            >
              Previous
            </button>
            <button
              type="button"
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
              className="admin-interactive admin-focus h-11 rounded-[var(--radius-md)] border border-[var(--line)] bg-white px-4 font-medium sm:h-9 sm:px-3 text-[var(--ink-700)] hover:bg-[var(--sand-100)] disabled:cursor-not-allowed disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export type { ColumnDef } from "@tanstack/react-table";
