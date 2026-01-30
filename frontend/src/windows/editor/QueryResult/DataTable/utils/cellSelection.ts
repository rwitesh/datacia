// Selection types
export interface CellPosition {
    row: number;
    col: number;
}

export interface SelectionRange {
    start: CellPosition;
    end: CellPosition;
}

export interface SelectionState {
    ranges: SelectionRange[];
    selectedCells: Set<string>; // "row-col" format for quick lookup
    isSelecting: boolean;
    currentRange: SelectionRange | null;
}

// Helper functions
export function createCellKey(row: number, col: number): string {
    return `${row}-${col}`;
}

export function getCellsInRange(
    start: CellPosition,
    end: CellPosition
): Set<string> {
    const cells = new Set<string>();
    const minRow = Math.min(start.row, end.row);
    const maxRow = Math.max(start.row, end.row);
    const minCol = Math.min(start.col, end.col);
    const maxCol = Math.max(start.col, end.col);

    for (let row = minRow; row <= maxRow; row++) {
        for (let col = minCol; col <= maxCol; col++) {
            cells.add(createCellKey(row, col));
        }
    }
    return cells;
}

export function updateSelectedCells(ranges: SelectionRange[]): Set<string> {
    const allSelectedCells = new Set<string>();
    ranges.forEach((range) => {
        const cellsInRange = getCellsInRange(range.start, range.end);
        cellsInRange.forEach((cell) => allSelectedCells.add(cell));
    });
    return allSelectedCells;
}

export function isCellSelected(
    selectedCells: Set<string>,
    row: number,
    col: number
): boolean {
    return selectedCells.has(createCellKey(row, col));
}

export function isCellOnTopEdge(
    selectedCells: Set<string>,
    row: number,
    col: number
): boolean {
    if (!isCellSelected(selectedCells, row, col)) return false;
    return !isCellSelected(selectedCells, row - 1, col);
}

export function isCellOnBottomEdge(
    selectedCells: Set<string>,
    row: number,
    col: number
): boolean {
    if (!isCellSelected(selectedCells, row, col)) return false;
    return !isCellSelected(selectedCells, row + 1, col);
}

export function isCellOnLeftEdge(
    selectedCells: Set<string>,
    row: number,
    col: number
): boolean {
    if (!isCellSelected(selectedCells, row, col)) return false;
    return !isCellSelected(selectedCells, row, col - 1);
}

export function isCellOnRightEdge(
    selectedCells: Set<string>,
    row: number,
    col: number
): boolean {
    if (!isCellSelected(selectedCells, row, col)) return false;
    return !isCellSelected(selectedCells, row, col + 1);
}

export function getCellBoxShadow(
    selectedCells: Set<string>,
    row: number,
    col: number
): string | undefined {
    if (!isCellSelected(selectedCells, row, col)) return undefined;

    const shadows: string[] = [];
    const color = "#2563eb"; // blue-600

    if (isCellOnTopEdge(selectedCells, row, col)) {
        shadows.push(`inset 0 2px 0 0 ${color}`);
    }
    if (isCellOnBottomEdge(selectedCells, row, col)) {
        shadows.push(`inset 0 -2px 0 0 ${color}`);
    }
    if (isCellOnLeftEdge(selectedCells, row, col)) {
        shadows.push(`inset 2px 0 0 0 ${color}`);
    }
    if (isCellOnRightEdge(selectedCells, row, col)) {
        shadows.push(`inset -2px 0 0 0 ${color}`);
    }

    return shadows.length > 0 ? shadows.join(", ") : undefined;
}
