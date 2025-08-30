import { useState, useRef, useMemo, useLayoutEffect } from "react";
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  type ColumnDef,
  type ColumnResizeMode,
  type CellContext,
  type HeaderContext,
} from "@tanstack/react-table";
import { useVirtualizer } from "@tanstack/react-virtual";

type DataRow = Record<string, unknown>;

type Props = {
  columns: string[];
  data: DataRow[];
  extraBlankRows?: number;
  showIndex?: boolean;
};

export function DataTable({
  columns,
  data,
  extraBlankRows = 5,
  showIndex = false,
}: Props) {
  const [columnSizing, setColumnSizing] = useState<Record<string, number>>({});
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [containerwidth, setContainerWidth] = useState(0);
  const [containerHeight, setContainerHeight] = useState(0);

  // Track container size
  useLayoutEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver(([entry]) => {
      setContainerWidth(entry.contentRect.width);
      setContainerHeight(entry.contentRect.height);
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  // Generate Column Definitions
  const columnDefs = useMemo<ColumnDef<DataRow>[]>(() => {
    const baseColumns = columns.map((colKey) => {
      return {
        id: colKey,
        accessorFn: (row: DataRow) => row[colKey],
        header: colKey,
        cell: (info: CellContext<DataRow, unknown>) => {
          const value = info.getValue();
          if (value === null || value === undefined) return "NULL";
          if (typeof value === "object") return JSON.stringify(value);
          return String(value);
        },
      };
    });

    if (showIndex) {
      return [
        {
          accessorKey: "_index",
          header: "",
          cell: (info: CellContext<DataRow, unknown>) => info.row.index + 1,
          size: 20,
        },
        ...baseColumns,
      ];
    }

    return baseColumns;
  }, [columns, showIndex]);

  const table = useReactTable({
    data,
    columns: columnDefs,
    getCoreRowModel: getCoreRowModel(),
    columnResizeMode: "onChange" as ColumnResizeMode,
    state: { columnSizing },
    onColumnSizingChange: setColumnSizing,
    enableMultiRowSelection: true,
  });

  const rows = table.getRowModel().rows;
  const headers = table.getFlatHeaders();
  let colWidths = headers.map((h) => Math.max(40, Math.floor(h.getSize())));
  let totalWidth = colWidths.reduce((a, b) => a + b, 0);
  const rowHeight = 24;

  // Stretch columns to fill container proportionally if total width < container width
  if (containerwidth > totalWidth && colWidths.length > 0) {
    const extraSpace = containerwidth - totalWidth;
    const extraPerCol = extraSpace / colWidths.length;
    colWidths = colWidths.map((w) => w + extraPerCol);
    totalWidth = containerwidth;
  }

  const gridTemplateColumns = useMemo(
    () => colWidths.map((w) => `${w}px`).join(" "),
    [colWidths]
  );

  // Calculate total rows including extra blank rows
  const totalRows = rows.length + extraBlankRows;

  // Virtualize Rows (including extra blank rows)
  const rowVirtualizer = useVirtualizer({
    count: totalRows,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => rowHeight,
    overscan: 10,
  });

  // Calculate additional filler rows to fill remaining height (beyond the guaranteed extra blank rows)
  const visibleHeight = rowVirtualizer.getTotalSize();
  const additionalFillerRows =
    containerHeight > visibleHeight
      ? Math.ceil((containerHeight - visibleHeight) / rowHeight)
      : 0;

  if (!columns.length) {
    return (
      <div className="p-3 text-muted-foreground text-xs">
        No columns to display.
      </div>
    );
  }

  return (
    <div className="h-full w-full overflow-hidden">
      <div
        ref={(el) => {
          scrollRef.current = el;
          containerRef.current = el;
        }}
        className="h-full w-full overflow-auto"
        style={{ contain: "strict" }}
      >
        <div className="sticky top-0 z-10 bg-muted">
          <table
            className="table-fixed border-separate border-spacing-0 text-xs cursor-default select-none"
            style={{ width: totalWidth }}
          >
            <thead>
              {table.getHeaderGroups().map((headerGroup) => (
                <tr key={headerGroup.id}>
                  {headerGroup.headers.map((header, i) => (
                    <th
                      key={header.id}
                      colSpan={header.colSpan}
                      style={{ width: colWidths[i] }}
                      className="relative border border-border bg-muted px-2 py-1 font-medium"
                    >
                      <div className="flex items-center justify-center h-full">
                        <span className="overflow-hidden text-ellipsis whitespace-nowrap">
                          {flexRender(
                            header.column.columnDef.header,
                            header.getContext() as HeaderContext<
                              DataRow,
                              unknown
                            >
                          )}
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
          </table>
        </div>
        <div
          className="relative"
          style={{
            width: totalWidth,
            height:
              rowVirtualizer.getTotalSize() + additionalFillerRows * rowHeight,
          }}
        >
          {rowVirtualizer.getVirtualItems().map((vi) => {
            const isDataRow = vi.index < rows.length;
            const row = isDataRow ? rows[vi.index] : null;
            const even = vi.index % 2 === 0;

            return (
              <div
                key={isDataRow ? row!.id : `blank-row-${vi.index}`}
                role="row"
                className={`${even ? "bg-muted" : "bg-background"}`}
                style={{
                  position: "absolute",
                  insetInlineStart: 0,
                  transform: `translateY(${vi.start}px)`,
                  width: totalWidth,
                  height: vi.size,
                  display: "grid",
                  gridTemplateColumns,
                }}
              >
                {isDataRow
                  ? // Render data row
                    row!.getVisibleCells().map((cell, ci) => (
                      <div
                        key={cell.id}
                        role="cell"
                        className="relative border-r border-border px-2"
                        style={{ width: colWidths[ci] }}
                      >
                        <div className="overflow-hidden text-ellipsis whitespace-nowrap text-xs h-full flex items-center cursor-default select-none">
                          {flexRender(
                            cell.column.columnDef.cell,
                            cell.getContext()
                          )}
                        </div>
                      </div>
                    ))
                  : // Render blank row
                    colWidths.map((w, ci) => (
                      <div
                        key={`blank-cell-${vi.index}-${ci}`}
                        role="cell"
                        className="relative border-r border-border px-2"
                        style={{ width: w }}
                      >
                        <div className="h-full flex items-center cursor-default select-none">
                          {/* Empty content for blank rows */}
                        </div>
                      </div>
                    ))}
              </div>
            );
          })}

          {/* Additional filler rows to fill remaining container height */}
          {additionalFillerRows > 0 &&
            Array.from({ length: additionalFillerRows }).map((_, idx) => {
              const top = rowVirtualizer.getTotalSize() + idx * rowHeight;
              const isEven = (totalRows + idx) % 2 === 0;
              return (
                <div
                  key={`filler-${idx}`}
                  role="row"
                  className={isEven ? "bg-muted" : "bg-background"}
                  style={{
                    position: "absolute",
                    insetInlineStart: 0,
                    transform: `translateY(${top}px)`,
                    width: totalWidth,
                    height: rowHeight,
                    display: "grid",
                    gridTemplateColumns,
                  }}
                >
                  {colWidths.map((w, ci) => (
                    <div
                      key={`filler-cell-${ci}`}
                      style={{ width: w }}
                      className="border-r border-border"
                    />
                  ))}
                </div>
              );
            })}
        </div>
      </div>
    </div>
  );
}
