import { useMemo } from "react";
import { type ColumnDef, type CellContext } from "@tanstack/react-table";
import type { DataRow } from "../types";

// Special column ID for serial number
export const SERIAL_COLUMN_ID = "#";

export function useTableColumns(columns: string[], offset: number = 0) {
    const columnDefs = useMemo<ColumnDef<DataRow>[]>(() => {
        // Serial number column
        const serialColumn: ColumnDef<DataRow> = {
            id: SERIAL_COLUMN_ID,
            accessorFn: (_row: DataRow, index: number) => offset + index + 1,
            header: "#",
            cell: (info: CellContext<DataRow, unknown>) => {
                return info.getValue();
            },
            enableResizing: true,
            enableSorting: false,
        };

        // Data columns
        const dataColumns = columns.map((colKey, index) => ({
            id: colKey,
            accessorFn: (row: DataRow) => row[colKey],
            header: colKey,
            cell: (info: CellContext<DataRow, unknown>) => {
                const value = info.getValue();
                if (value === null || value === undefined) return "NULL";
                if (typeof value === "object") return JSON.stringify(value);
                return String(value);
            },
            enableResizing: index < columns.length - 1, // Disable resize for last column
        }));

        return [serialColumn, ...dataColumns];
    }, [columns, offset]);

    return columnDefs;
}
