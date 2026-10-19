import { memo } from "react";
import { flexRender, type Row } from "@tanstack/react-table";
import { formatCellValue } from "@/lib/utils";
import type { DataRow } from "../types";
import { ROW_HEIGHT } from "../utils/layout";
import { formatTimestampTooltip, parseTimestamp } from "../utils/timestamp";

interface TableRowProps {
  row: Row<DataRow>;
  index: number;
  top: number;
  rowNumber: number;
}

// TableRow takes only stable or primitive props, and column widths come from
// CSS variables on the grid, so selection changes and column resizes don't
// re-render rows.
export const TableRow = memo(function TableRow({ row, index, top, rowNumber }: TableRowProps) {
  // The first cell belongs to the row-number column, rendered from rowNumber.
  const [, ...cells] = row.getVisibleCells();
  return (
    <div
      role="row"
      className="absolute left-0 grid"
      style={{
        transform: `translateY(${top}px)`,
        height: ROW_HEIGHT,
        width: "var(--grid-width)",
        gridTemplateColumns: "var(--grid-columns)",
      }}
    >
      <div
        role="rowheader"
        data-row={index}
        data-col={-1}
        className="sticky left-0 flex items-center border-r border-b border-border/60 bg-muted px-2 font-medium text-muted-foreground hover:bg-accent"
      >
        {rowNumber}
      </div>
      {cells.map((cell, col) => (
        <div
          key={cell.id}
          role="gridcell"
          data-row={index}
          data-col={col}
          title={cellTitle(cell.getValue())}
          className="truncate border-r border-b border-border/60 px-2 leading-[23px] hover:bg-blue-500/10"
        >
          {flexRender(cell.column.columnDef.cell, cell.getContext())}
        </div>
      ))}
    </div>
  );
});

// cellTitle shows the full value of truncated cells, plus local and UTC time
// for values that look like timestamps.
function cellTitle(value: unknown) {
  if (value === null || value === undefined) return undefined;
  const text = formatCellValue(value);
  const date = parseTimestamp(value);
  if (!date) return text;
  const { local, utc } = formatTimestampTooltip(date);
  return `${text}\nLocal: ${local}\nUTC: ${utc}`;
}
