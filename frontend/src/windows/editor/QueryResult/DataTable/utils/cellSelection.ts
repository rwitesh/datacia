import type { DataRow } from "../types";

// Row and column indices are positions in the grid as shown (after any client
// sort). Columns count data columns only; the row-number column is not part
// of a selection.
export interface CellPosition {
  row: number;
  col: number;
}

// CellSelection is a rectangular range. anchor is the cell it started from
// (Shift+click and Shift+arrow extend from it); focus is the end that moves.
export interface CellSelection {
  anchor: CellPosition;
  focus: CellPosition;
}

interface SelectionBounds {
  top: number;
  bottom: number;
  left: number;
  right: number;
}

export function getSelectionBounds({ anchor, focus }: CellSelection): SelectionBounds {
  return {
    top: Math.min(anchor.row, focus.row),
    bottom: Math.max(anchor.row, focus.row),
    left: Math.min(anchor.col, focus.col),
    right: Math.max(anchor.col, focus.col),
  };
}

export function isCellSelected(selection: CellSelection | null, { row, col }: CellPosition) {
  if (!selection) return false;
  const { top, bottom, left, right } = getSelectionBounds(selection);
  return row >= top && row <= bottom && col >= left && col <= right;
}

// isSelectionInGrid rejects a saved selection that no longer fits the rows
// and columns shown.
export function isSelectionInGrid(
  selection: CellSelection | null | undefined,
  rowCount: number,
  colCount: number
): selection is CellSelection {
  return Boolean(
    selection &&
      [selection.anchor, selection.focus].every(
        (cell) => cell.row >= 0 && cell.row < rowCount && cell.col >= 0 && cell.col < colCount
      )
  );
}

// getSelectedData returns the selected columns and, for each selected row,
// an object holding just those columns.
export function getSelectedData(
  selection: CellSelection | null,
  columns: string[],
  rows: DataRow[]
): { columns: string[]; rows: DataRow[] } {
  if (!isSelectionInGrid(selection, rows.length, columns.length)) {
    return { columns: [], rows: [] };
  }
  const { top, bottom, left, right } = getSelectionBounds(selection);
  const selectedColumns = columns.slice(left, right + 1);
  return {
    columns: selectedColumns,
    rows: rows
      .slice(top, bottom + 1)
      .map((row) => Object.fromEntries(selectedColumns.map((column) => [column, row[column]]))),
  };
}
