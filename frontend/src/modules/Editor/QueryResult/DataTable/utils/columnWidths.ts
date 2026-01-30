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

// Minimum width for serial number column (for header "#" + some padding)
const MIN_SERIAL_COL_WIDTH = 32;
const SERIAL_COL_PADDING = 16; // Padding for serial column (less than data columns)
const SERIAL_COLUMN_ID = "#";

/**
 * Calculates content-based column widths by measuring header and cell text.
 * Squeezes columns only when safe (content still fits).
 * 
 * @param headers - Table headers including serial column
 * @param data - Data rows
 * @param offset - Pagination offset for serial number calculation
 */
export function calculateContentWidths(
    headers: Header<DataRow, unknown>[],
    data: DataRow[],
    offset: number = 0
): number[] {
    const measureText = createTextMeasurer();

    if (!measureText) {
        // Fallback to default sizing if canvas is unavailable
        return headers.map((h) => {
            if (h.column.id === SERIAL_COLUMN_ID) return MIN_SERIAL_COL_WIDTH;
            return Math.max(MIN_COL_WIDTH, Math.floor(h.getSize()));
        });
    }

    return headers.map((h) => {
        const columnId = h.column.id;

        // Serial column: calculate width based on maximum serial number
        if (columnId === SERIAL_COLUMN_ID) {
            // Max serial number is offset + data.length
            const maxSerialNumber = offset + data.length;
            const maxSerialText = String(maxSerialNumber);
            const serialTextWidth = measureText(maxSerialText) + SERIAL_COL_PADDING;
            // Also consider header "#" width
            const headerWidth = measureText("#") + SERIAL_COL_PADDING;
            return Math.max(MIN_SERIAL_COL_WIDTH, Math.ceil(serialTextWidth), Math.ceil(headerWidth));
        }

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
