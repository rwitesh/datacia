import { flexRender, type Header } from "@tanstack/react-table";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import type { DataRow } from "../types";
import { HEADER_HEIGHT } from "../utils/layout";

interface TableHeaderProps {
  headers: Header<DataRow, unknown>[];
}

// TableHeader is the sticky header row. The row-number corner (data-col -1)
// selects everything; other headers select their column.
export function TableHeader({ headers }: TableHeaderProps) {
  return (
    <div
      role="row"
      className="sticky top-0 z-20 grid font-medium"
      style={{
        height: HEADER_HEIGHT,
        width: "var(--grid-width)",
        gridTemplateColumns: "var(--grid-columns)",
      }}
    >
      {headers.map((header, index) => {
        const { column } = header;
        const sortDirection = column.getIsSorted();
        const SortIcon = sortDirection === "asc" ? ArrowUp : sortDirection === "desc" ? ArrowDown : ArrowUpDown;
        const startResize = header.getResizeHandler();
        return (
          <div
            key={header.id}
            role="columnheader"
            data-col={index - 1}
            title={index === 0 ? "Select all" : column.id}
            className={cn(
              "relative flex items-center justify-center gap-1 border-[0.5px] border-border/60 bg-card px-2",
              index === 0 && "sticky left-0 z-10"
            )}
          >
            <span className="truncate">
              {flexRender(column.columnDef.header, header.getContext())}
            </span>
            {column.getCanSort() && (
              <button
                type="button"
                onMouseDown={(event) => {
                  // Keep focus (and keyboard navigation) on the grid.
                  event.preventDefault();
                  event.stopPropagation();
                }}
                onClick={column.getToggleSortingHandler()}
                className={cn(
                  "flex items-center justify-center rounded p-0.5 hover:bg-blue-500 hover:text-white",
                  sortDirection ? "text-blue-500" : "text-muted-foreground"
                )}
                title="Sort"
              >
                <SortIcon className="h-3 w-3" />
              </button>
            )}
            <div
              onMouseDown={(event) => {
                event.stopPropagation();
                startResize(event);
              }}
              onTouchStart={startResize}
              onDoubleClick={() => column.resetSize()}
              title="Drag to resize, double-click to fit"
              className={cn(
                "absolute -right-1 top-0 z-10 h-full w-2 cursor-col-resize",
                column.getIsResizing() ? "bg-blue-500" : "hover:bg-blue-500/50"
              )}
            />
          </div>
        );
      })}
    </div>
  );
}
