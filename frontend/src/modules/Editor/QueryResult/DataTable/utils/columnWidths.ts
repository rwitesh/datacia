import type { Header } from "@tanstack/react-table";
import type { DataRow } from "../types";

const TABLE_FONT = "12px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
const CELL_PADDING = 40; // px-2 (8px each side) + sort icon + buffer
const MIN_COL_WIDTH = 40;
const SAMPLE_SIZE = 100; // Max rows to sample for performance

/**
 * Measures the rendered text width using canvas.
 */
function createTextMeasurer(): ((text: string) => number) | null {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.font = TABLE_FONT;
    return (text: string) => ctx.measureText(text).width;
}

/**
 * Formats a cell value for display (matches useTableColumns logic).
 */
function formatCellValue(value: unknown): string {
    if (value === null || value === undefined) return "NULL";
    if (typeof value === "object") return JSON.stringify(value);
    return String(value);
}

/**
 * Calculates content-based column widths by measuring header and cell text.
 * Squeezes columns only when safe (content still fits).
 */
export function calculateContentWidths(
    headers: Header<DataRow, unknown>[],
    data: DataRow[]
): number[] {
    const measureText = createTextMeasurer();

    if (!measureText) {
        // Fallback to default sizing if canvas is unavailable
        return headers.map((h) => Math.max(MIN_COL_WIDTH, Math.floor(h.getSize())));
    }

    return headers.map((h) => {
        const columnId = h.column.id;
        const defaultWidth = Math.floor(h.getSize());

        // Measure header text width
        const headerWidth = measureText(columnId) + CELL_PADDING;

        // Sample cell values for width calculation
        let maxCellWidth = 0;
        const sampleCount = Math.min(data.length, SAMPLE_SIZE);
        for (let i = 0; i < sampleCount; i++) {
            const displayValue = formatCellValue(data[i]?.[columnId]);
            maxCellWidth = Math.max(maxCellWidth, measureText(displayValue));
        }

        // Calculate minimum required width (content + padding)
        const contentWidth = Math.max(headerWidth, maxCellWidth + CELL_PADDING);

        // Only squeeze if content fits; never reduce below content width
        return Math.floor(Math.max(MIN_COL_WIDTH, Math.min(defaultWidth, contentWidth)));
    });
}

/**
 * Distributes extra horizontal space evenly across all columns.
 * Returns the adjusted column widths and total width.
 */
export function distributeExtraSpace(
    colWidths: number[],
    containerWidth: number
): { finalColWidths: number[]; totalWidth: number } {
    const finalColWidths = [...colWidths];
    let totalWidth = colWidths.reduce((a, b) => a + b, 0);

    if (containerWidth > totalWidth && finalColWidths.length > 0) {
        const extraSpace = containerWidth - totalWidth;
        const extraPerColumn = Math.floor(extraSpace / finalColWidths.length);
        const remainder = extraSpace - extraPerColumn * finalColWidths.length;

        for (let i = 0; i < finalColWidths.length; i++) {
            finalColWidths[i] += extraPerColumn + (i < remainder ? 1 : 0);
        }
        totalWidth = containerWidth;
    }

    return { finalColWidths, totalWidth };
}
