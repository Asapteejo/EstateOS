import { Card } from "@/components/ui/card";
import { SimpleDataTable } from "@/components/ui/simple-data-table";

/**
 * Titled table card. Same external API as before (title + string columns +
 * string rows, all serializable from server components), but the internals
 * now run on the shared TanStack DataTable — so every consumer (Audit Logs,
 * Documents, Transactions) gains column sorting, an optional search box, and
 * pagination for long lists instead of one unbounded static table.
 */
export function DataTableCard({
  title,
  columns,
  rows,
  searchPlaceholder,
  pageSize = 25,
}: {
  title: string;
  columns: string[];
  rows: string[][];
  /** When set, shows a search input that filters across all columns. */
  searchPlaceholder?: string;
  /** Rows per page. Pass 0 to disable pagination. */
  pageSize?: number;
}) {
  return (
    <Card className="admin-table-shell overflow-hidden">
      <div className="border-b border-[var(--line)] px-5 py-4">
        <h3 className="text-lg font-semibold text-[var(--ink-950)]">{title}</h3>
      </div>
      <SimpleDataTable
        columns={columns}
        rows={rows}
        searchPlaceholder={searchPlaceholder}
        pageSize={pageSize}
        emptyTitle="No records yet"
        frameless
      />
    </Card>
  );
}
