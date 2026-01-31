// Selection types
export interface CellPosition {
    row: number;
    col: number;
}

export interface SelectionGeometry {
    topLeft: CellPosition;
    topRight: CellPosition;
    bottomLeft: CellPosition;
    bottomRight: CellPosition;
}

export interface SelectionState {
    geometry: SelectionGeometry | null;
    isSelecting: boolean;
}

export function createSelectionGeometry(
    startRow: number,
    startCol: number,
    endRow: number,
    endCol: number
): SelectionGeometry {
    const minRow = Math.min(startRow, endRow);
    const maxRow = Math.max(startRow, endRow);
    const minCol = Math.min(startCol, endCol);
    const maxCol = Math.max(startCol, endCol);

    return {
        topLeft: { row: minRow, col: minCol },
        topRight: { row: minRow, col: maxCol },
        bottomLeft: { row: maxRow, col: minCol },
        bottomRight: { row: maxRow, col: maxCol },
    };
}

export function isCellInSelection(
    selection: SelectionGeometry | null,
    row: number,
    col: number
): boolean {
    if (!selection) return false;
    return (
        row >= selection.topLeft.row &&
        row <= selection.bottomLeft.row &&
        col >= selection.topLeft.col &&
        col <= selection.topRight.col
    );
}

export function isTopEdge(selection: SelectionGeometry, row: number): boolean {
    return row === selection.topLeft.row;
}

export function isBottomEdge(selection: SelectionGeometry, row: number): boolean {
    return row === selection.bottomLeft.row;
}

export function isLeftEdge(selection: SelectionGeometry, col: number): boolean {
    return col === selection.topLeft.col;
}

export function isRightEdge(selection: SelectionGeometry, col: number): boolean {
    return col === selection.topRight.col;
}

export function getCellBoxShadow(
    selection: SelectionGeometry | null,
    row: number,
    col: number
): string | undefined {
    if (!isCellInSelection(selection, row, col)) return undefined;

    const shadows: string[] = [];
    const color = "#2563eb"; // blue-600

    if (isTopEdge(selection!, row)) {
        shadows.push(`inset 0 2px 0 0 ${color}`);
    }
    if (isBottomEdge(selection!, row)) {
        shadows.push(`inset 0 -2px 0 0 ${color}`);
    }
    if (isLeftEdge(selection!, col)) {
        shadows.push(`inset 2px 0 0 0 ${color}`);
    }
    if (isRightEdge(selection!, col)) {
        shadows.push(`inset -2px 0 0 0 ${color}`);
    }

    return shadows.length > 0 ? shadows.join(", ") : undefined;
}

export function extractSelectedData(
    selection: SelectionGeometry | null,
    columns: string[],
    data: Array<Record<string, unknown>>
): Array<Record<string, unknown>> {
    if (!selection || data.length === 0 || columns.length === 0) {
        return [];
    }

    const result: Array<Record<string, unknown>> = [];
    const { topLeft, bottomLeft, topRight } = selection;

    for (let row = topLeft.row; row <= bottomLeft.row; row++) {
        if (row < 0 || row >= data.length) continue;

        const rowData: Record<string, unknown> = {};
        let hasData = false;

        for (let col = topLeft.col; col <= topRight.col; col++) {
            if (col < 0 || col >= columns.length) continue;

            const columnKey = columns[col];
            rowData[columnKey] = data[row][columnKey];
            hasData = true;
        }

        if (hasData) {
            result.push(rowData);
        }
    }

    return result;
}
