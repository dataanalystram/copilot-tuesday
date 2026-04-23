"use client";

export interface DataTableProps {
  title?: string;
  columns: string[];
  rows: Array<Record<string, string | number>>;
}

export function DataTableWidget({ title, columns, rows }: DataTableProps) {
  return (
    <div className="flex h-full flex-col">
      {title && <div className="mb-2 text-[11px] uppercase tracking-widest opacity-60">{title}</div>}
      <div className="min-h-0 flex-1 overflow-auto rounded-md border border-white/8">
        <table className="w-full min-w-[420px] border-collapse text-left text-xs">
          <thead className="sticky top-0 bg-white/8 backdrop-blur">
            <tr>
              {columns.map((column) => (
                <th key={column} className="border-b border-white/10 px-3 py-2 font-medium uppercase tracking-wider text-white/55">
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.slice(0, 12).map((row, index) => (
              <tr key={index} className="odd:bg-white/[0.025] hover:bg-cyan-300/8">
                {columns.map((column) => (
                  <td key={column} className="border-b border-white/6 px-3 py-2 text-white/72" title={String(row[column] ?? "")}>
                    {String(row[column] ?? "")}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
