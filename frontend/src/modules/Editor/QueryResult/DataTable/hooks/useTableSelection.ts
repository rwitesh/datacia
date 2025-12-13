import React, { useState, useCallback, useLayoutEffect, useEffect } from "react";
import {
    type SelectionState,
    type SelectionRange,
    type CellPosition,
    createCellKey,
    updateSelectedCells,
} from "../utils/cellSelection";

interface UseTableSelectionProps {
    columns: string[];
    data: Array<Record<string, unknown>>;
    onSelectionChange: (selected: Array<Record<string, unknown>>) => void;
}

export function useTableSelection({ columns, data, onSelectionChange }: UseTableSelectionProps) {
    const [selection, setSelection] = useState<SelectionState>({
        ranges: [],
        selectedCells: new Set(),
        isSelecting: false,
        currentRange: null,
    });
    const [selectedData, setSelectedData] = useState<Array<Record<string, unknown>>>([]);

    // Handle mouse down on cell
    const handleCellMouseDown = useCallback(
        (row: number, col: number, event: React.MouseEvent) => {
            // Right click behavior:
            if (event.button === 2) {
                // 1. If right-clicking on a cell that is already selected (part of multi-selection), do NOT select/deselect. Keep the current selection so the context menu acts on it.
                // 2. If right-clicking on an unselected cell, treat it as a normal click (select it), checking the "single selection" logic below which will reset other selections.

                const cellKey = createCellKey(row, col);
                if (selection.selectedCells.has(cellKey)) {
                    // Already selected, ignore right click to preserve multi-selection
                    return;
                }
                // Not selected: allow fall-through to normal selection logic (will behave like left click)
            }

            event.preventDefault();

            const newPosition: CellPosition = { row, col };

            if (event.ctrlKey || event.metaKey) {
                // Ctrl+Click: Add new range
                const newRange: SelectionRange = {
                    start: newPosition,
                    end: newPosition,
                };
                const newRanges = [...selection.ranges, newRange];
                const newSelectedCells = updateSelectedCells(newRanges);

                setSelection({
                    ranges: newRanges,
                    selectedCells: newSelectedCells,
                    isSelecting: false,
                    currentRange: null,
                });
            } else if (event.shiftKey && selection.ranges.length > 0) {
                // Shift+Click: Extend last range
                const lastRange = selection.ranges[selection.ranges.length - 1];
                const extendedRange: SelectionRange = {
                    start: lastRange.start,
                    end: newPosition,
                };
                const newRanges = [...selection.ranges.slice(0, -1), extendedRange];
                const newSelectedCells = updateSelectedCells(newRanges);

                setSelection({
                    ranges: newRanges,
                    selectedCells: newSelectedCells,
                    isSelecting: false,
                    currentRange: null,
                });
            } else {
                // Regular click: Toggle selection if clicking on same single cell, otherwise start new selection
                const cellKey = createCellKey(row, col);
                const isSingleCellSelected =
                    selection.ranges.length === 1 &&
                    selection.ranges[0].start.row === row &&
                    selection.ranges[0].start.col === col &&
                    selection.ranges[0].end.row === row &&
                    selection.ranges[0].end.col === col;

                if (isSingleCellSelected) {
                    // Clicking same cell again: unselect
                    setSelection({
                        ranges: [],
                        selectedCells: new Set(),
                        isSelecting: false,
                        currentRange: null,
                    });
                } else {
                    // Start new selection
                    const newRange: SelectionRange = {
                        start: newPosition,
                        end: newPosition,
                    };
                    setSelection({
                        ranges: [newRange],
                        selectedCells: new Set([cellKey]),
                        isSelecting: true,
                        currentRange: newRange,
                    });
                }
            }
        },
        [selection.ranges]
    );

    // Handle mouse enter on cell (for dragging)
    const handleCellMouseEnter = useCallback(
        (row: number, col: number) => {
            if (selection.isSelecting && selection.currentRange) {
                const newEnd: CellPosition = { row, col };
                const updatedRange: SelectionRange = {
                    start: selection.currentRange.start,
                    end: newEnd,
                };

                const otherRanges = selection.ranges.slice(0, -1);
                const newRanges = [...otherRanges, updatedRange];
                const newSelectedCells = updateSelectedCells(newRanges);

                setSelection((prev) => ({
                    ...prev,
                    ranges: newRanges,
                    selectedCells: newSelectedCells,
                    currentRange: updatedRange,
                }));
            }
        },
        [selection.isSelecting, selection.currentRange, selection.ranges]
    );

    // Handle mouse up (end selection)
    const handleMouseUp = useCallback(() => {
        setSelection((prev) => ({
            ...prev,
            isSelecting: false,
            currentRange: null,
        }));
    }, []);

    // Add global mouse up listener
    useLayoutEffect(() => {
        document.addEventListener("mouseup", handleMouseUp);
        return () => document.removeEventListener("mouseup", handleMouseUp);
    }, [handleMouseUp]);

    // Handle column header click (select entire column)
    const handleColumnHeaderClick = useCallback(
        (colIndex: number, event: React.MouseEvent) => {
            event.preventDefault();
            event.stopPropagation();

            const totalDataRows = data.length;
            if (totalDataRows === 0) return;

            const columnRange: SelectionRange = {
                start: { row: 0, col: colIndex },
                end: { row: totalDataRows - 1, col: colIndex },
            };

            if (event.ctrlKey || event.metaKey) {
                // Add column to selection
                const newRanges = [...selection.ranges, columnRange];
                const newSelectedCells = updateSelectedCells(newRanges);
                setSelection({
                    ranges: newRanges,
                    selectedCells: newSelectedCells,
                    isSelecting: false,
                    currentRange: null,
                });
            } else {
                // Select only this column
                const newSelectedCells = updateSelectedCells([columnRange]);
                setSelection({
                    ranges: [columnRange],
                    selectedCells: newSelectedCells,
                    isSelecting: false,
                    currentRange: null,
                });
            }
        },
        [data.length, selection.ranges]
    );

    // Notify parent about selection changes
    useEffect(() => {
        const selectedData: Array<Record<string, unknown>> = [];

        selection.ranges.forEach((range) => {
            const minRow = Math.min(range.start.row, range.end.row);
            const maxRow = Math.max(range.start.row, range.end.row);
            const minCol = Math.min(range.start.col, range.end.col);
            const maxCol = Math.max(range.start.col, range.end.col);

            for (let row = minRow; row <= maxRow; row++) {
                if (row >= data.length) continue;

                const rowData: Record<string, unknown> = {};
                let hasData = false;

                for (let col = minCol; col <= maxCol; col++) {
                    if (col >= columns.length) continue;
                    const columnKey = columns[col];
                    rowData[columnKey] = data[row][columnKey];
                    hasData = true;
                }

                if (hasData) {
                    selectedData.push(rowData);
                }
            }
        });

        setSelectedData(selectedData);
        onSelectionChange(selectedData);
    }, [selection, data, columns, onSelectionChange]);

    return {
        selection,
        selectedData,
        handleCellMouseDown,
        handleCellMouseEnter,
        handleColumnHeaderClick,
    };
}
