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
    <Card className="admin-table-shell">
      <div className="border-b border-[var(--line)] px-5 py-4">
        <h3 className="text-lg font-semibold text-[var(--ink-950)]">{title}</h3>
      </div>
      <div className="overflow-auto">
        <table className="admin-table">
          <thead>
            <tr>
              {columns.map((column) => (
                <th key={column}>
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={`${title}-${index}`}>
                {row.map((cell) => (
                  <td key={cell}>
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
