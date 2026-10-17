import { useMemo } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { formatCellValue } from "@/lib/utils";
import type { DataRow } from "../types";
import { MIN_COLUMN_WIDTH } from "../utils/layout";

export const ROW_NUMBER_COLUMN_ID = "#";

// useTableColumns builds the row-number column plus one column per result
// column. widths are the initial sizes (row-number column first); user
// resizes live in the table's columnSizing state on top of them.
export function useTableColumns(columns: string[], widths: number[]) {
  return useMemo<ColumnDef<DataRow>[]>(
    () => [
      {
        id: ROW_NUMBER_COLUMN_ID,
        header: "#",
        size: widths[0],
        minSize: MIN_COLUMN_WIDTH,
        enableSorting: false,
      },
      ...columns.map(
        (column, index): ColumnDef<DataRow> => ({
          id: column,
          header: column,
          accessorFn: (row) => row[column],
          cell: (info) => formatCellValue(info.getValue()),
          size: widths[index + 1],
          minSize: MIN_COLUMN_WIDTH,
        })
      ),
    ],
    [columns, widths]
  );
}
