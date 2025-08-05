import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  type ColumnDef,
  type ColumnResizeMode,
} from '@tanstack/react-table';

export function DataTable({
  columns,
  data,
}: {
  columns: string[];
  data: Record<string, any>[];
}) {
  if (!columns.length) {
    return (
      <div className="p-3 text-muted-foreground text-xs">
        No columns to display.
      </div>
    );
  }

  const columnDefs: ColumnDef<any>[] = columns.map((colKey) => ({
    accessorKey: colKey,
    header: colKey,
    cell: (info) => {
      const value = info.getValue();
      return value === null
        ? 'NULL'
        : typeof value === 'object'
          ? JSON.stringify(value)
          : String(value);
    },
  }));

  const table = useReactTable({
    data,
    columns: columnDefs,
    getCoreRowModel: getCoreRowModel(),
    columnResizeMode: 'onChange' as ColumnResizeMode,
  });

  return (
    <div className="h-full w-full overflow-auto rounded-lg">
      <table className="min-w-full table-fixed border-separate border-spacing-0 text-xs" style={{
        width: table.getCenterTotalSize(),
      }}>
        <thead className="sticky top-0 z-10 bg-muted">
          {table.getHeaderGroups().map((headerGroup) => (
            <tr key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <th
                  key={header.id}
                  colSpan={header.colSpan}
                  style={{ width: header.getSize() }}
                  className="relative border border-border bg-muted px-2 py-1 text-left font-medium select-none touch-none"
                >
                  <div className="flex items-center justify-between">
                    <span className="overflow-hidden text-ellipsis whitespace-nowrap pr-2">
                      {flexRender(header.column.columnDef.header, header.getContext())}
                    </span>
                  </div>
                  {header.column.getCanResize() && (
                    <div
                      onMouseDown={header.getResizeHandler()}
                      onTouchStart={header.getResizeHandler()}
                      className="absolute right-0 top-0 h-full w-2 cursor-col-resize bg-transparent"
                    />
                  )}
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody>
          {table.getRowModel().rows.map((row, rowIndex) => (
            <tr
              key={row.id}
              className={`${rowIndex % 2 === 0 ? 'bg-muted' : 'bg-background'
                }`}
            >
              {row.getVisibleCells().map((cell) => {
                const column = cell.column;
                const header = table.getFlatHeaders().find(
                  (h) => h.column.id === column.id
                );
                const resizeHandler = header?.getResizeHandler();

                return (
                  <td
                    key={cell.id}
                    style={{ width: column.getSize() }}
                    className="relative border-r border-border px-2 py-1"
                  >
                    <div className="overflow-hidden text-ellipsis whitespace-nowrap">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </div>
                    {column.getCanResize() && (
                      <div
                        onMouseDown={resizeHandler}
                        onTouchStart={resizeHandler}
                        className="absolute right-0 top-0 h-full w-2 cursor-col-resize bg-transparent active:select-none"
                      />
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
