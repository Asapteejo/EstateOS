import { Card } from "@/components/ui/card";

export function DataTableCard({
  title,
  columns,
  rows,
}: {
  title: string;
  columns: string[];
  rows: string[][];
}) {
  return (
    <Card className="overflow-hidden">
      <div className="border-b border-[var(--line)] px-6 py-4">
        <h3 className="text-lg font-semibold text-[var(--ink-950)]">{title}</h3>
      </div>
      <div className="overflow-auto">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-[var(--sand-100)] text-[var(--ink-500)]">
            <tr>
              {columns.map((column) => (
                <th key={column} className="px-6 py-3 font-medium">
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={`${title}-${index}`} className="border-t border-[var(--line)]">
                {row.map((cell) => (
                  <td key={cell} className="px-6 py-4 text-[var(--ink-700)]">
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
