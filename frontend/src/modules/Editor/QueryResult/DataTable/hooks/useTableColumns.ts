import { useMemo } from "react";
import { type ColumnDef, type CellContext } from "@tanstack/react-table";
import type { DataRow } from "../types";

export function useTableColumns(columns: string[]) {
    const columnDefs = useMemo<ColumnDef<DataRow>[]>(() => {
        return columns.map((colKey, index) => ({
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
    }, [columns]);

    return columnDefs;
}
