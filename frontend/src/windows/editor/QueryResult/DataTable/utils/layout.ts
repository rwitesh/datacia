import { formatCellValue } from "@/lib/utils";
import type { DataRow } from "../types";

export const ROW_HEIGHT = 24;
export const HEADER_HEIGHT = 28;
// The grid renders text-xs (12px) in the editor font family.
export const FONT_SIZE = 12;

export const MIN_COLUMN_WIDTH = 40;
// Long values start truncated at this width; the user can widen the column.
const MAX_INITIAL_COLUMN_WIDTH = 320;
const CELL_PADDING = 20; // px-2 on both sides plus borders
const HEADER_PADDING = 44; // px-2, gap and the sort button
// Measuring every row of a large result is slow and rarely changes the answer.
const SAMPLE_SIZE = 100;

// measureColumnWidths returns content-based widths for the row-number column
// followed by each data column.
export function measureColumnWidths(
  columns: string[],
  rows: DataRow[],
  lastRowNumber: number,
  fontFamily: string
): number[] {
  const context = document.createElement("canvas").getContext("2d");
  if (context) context.font = `${FONT_SIZE}px ${fontFamily}`;
  const measure = (text: string) =>
    context ? context.measureText(text).width : text.length * FONT_SIZE * 0.6;

  const sample = rows.slice(0, SAMPLE_SIZE);
  const rowNumberWidth = Math.ceil(measure(String(lastRowNumber)) + CELL_PADDING);

  // Every width is at least MIN_COLUMN_WIDTH, the grid's own minimum. A
  // narrower width here would be widened when drawn, so fillContainer would
  // overshoot the container and toggle the scrollbars in a resize loop.
  return [
    Math.max(rowNumberWidth, MIN_COLUMN_WIDTH),
    ...columns.map((column) => {
      let width = measure(column) + HEADER_PADDING;
      for (const row of sample) {
        width = Math.max(width, measure(formatCellValue(row[column])) + CELL_PADDING);
      }
      return Math.ceil(Math.min(Math.max(width, MIN_COLUMN_WIDTH), MAX_INITIAL_COLUMN_WIDTH));
    }),
  ];
}

// fillContainer spreads the container's leftover width evenly across the data
// columns, so a narrow result still fills the grid. The row-number column
// (index 0) keeps its width.
export function fillContainer(widths: number[], containerWidth: number): number[] {
  const dataColumnCount = widths.length - 1;
  const extra = Math.floor(containerWidth - widths.reduce((sum, width) => sum + width, 0));
  if (extra <= 0 || dataColumnCount <= 0) return widths;

  const perColumn = Math.floor(extra / dataColumnCount);
  const remainder = extra - perColumn * dataColumnCount;
  return widths.map((width, index) =>
    index === 0 ? width : width + perColumn + (index <= remainder ? 1 : 0)
  );
}
