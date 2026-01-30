import React, { useState, useCallback, useLayoutEffect, useEffect, useRef } from "react";
import {
    type SelectionState,
    type SelectionRange,
    createCellKey,
    updateSelectedCells,
} from "../utils/cellSelection";

// Cell type for unified handlers
export type CellType = 'data' | 'serial' | 'header';

// Selection mode tracks what type of selection is in progress
type SelectionMode = 'cell' | 'row' | 'column';

interface UseTableSelectionProps {
    columns: string[];
    data: Array<Record<string, unknown>>;
    onSelectionChange: (selected: Array<Record<string, unknown>>) => void;
    scrollRef: React.RefObject<HTMLDivElement | null>;
    rowHeight: number;
    colWidths: number[];
}

export function useTableSelection({ columns, data, onSelectionChange, scrollRef, rowHeight, colWidths }: UseTableSelectionProps) {
    const [selection, setSelection] = useState<SelectionState>({
        ranges: [],
        selectedCells: new Set(),
        isSelecting: false,
        currentRange: null,
    });
    const [selectedData, setSelectedData] = useState<Array<Record<string, unknown>>>([]);
    const autoScrollAnimationRef = useRef<number | null>(null);
    const lastMousePositionRef = useRef<{ x: number; y: number } | null>(null);

    // Track selection mode and drag start position
    const selectionModeRef = useRef<SelectionMode>('cell');
    const dragStartRef = useRef<{ row: number; col: number }>({ row: -1, col: -1 });

    /**
     * Unified mouse down handler for all cell types
     * @param cellType - 'data' | 'serial' | 'header'
     * @param row - Row index (-1 for header cells)
     * @param col - Column index (-1 for serial cells)
     * @param event - Mouse event
     */
    const handleMouseDown = useCallback(
        (cellType: CellType, row: number, col: number, event: React.MouseEvent) => {
            // Right click: preserve existing selection if clicking on selected cell
            if (event.button === 2) {
                const cellKey = createCellKey(row, col);
                if (selection.selectedCells.has(cellKey)) {
                    return;
                }
            }

            event.preventDefault();

            const totalRows = data.length;
            const totalCols = columns.length;
            if (totalRows === 0) return;

            let newRange: SelectionRange;
            let mode: SelectionMode;

            switch (cellType) {
                case 'header': {
                    // Column header click: select entire column
                    mode = 'column';
                    dragStartRef.current = { row: -1, col };
                    newRange = {
                        start: { row: 0, col },
                        end: { row: totalRows - 1, col },
                    };
                    break;
                }

                case 'serial': {
                    // Serial cell click: select entire row
                    mode = 'row';
                    dragStartRef.current = { row, col: -1 };
                    newRange = {
                        start: { row, col: 0 },
                        end: { row, col: totalCols - 1 },
                    };
                    break;
                }

                case 'data':
                default: {
                    // Data cell click: start rectangular selection
                    mode = 'cell';
                    dragStartRef.current = { row, col };

                    // Shift+Click: extend selection
                    if (event.shiftKey && selection.ranges.length > 0) {
                        const lastRange = selection.ranges[selection.ranges.length - 1];
                        newRange = {
                            start: lastRange.start,
                            end: { row, col },
                        };
                        const newRanges = [...selection.ranges.slice(0, -1), newRange];
                        const newSelectedCells = updateSelectedCells(newRanges);
                        setSelection({
                            ranges: newRanges,
                            selectedCells: newSelectedCells,
                            isSelecting: false,
                            currentRange: null,
                        });
                        return;
                    }

                    // Toggle off if clicking the same single cell
                    const isSameCell =
                        selection.ranges.length === 1 &&
                        selection.ranges[0].start.row === row &&
                        selection.ranges[0].start.col === col &&
                        selection.ranges[0].end.row === row &&
                        selection.ranges[0].end.col === col;

                    if (isSameCell) {
                        setSelection({
                            ranges: [],
                            selectedCells: new Set(),
                            isSelecting: false,
                            currentRange: null,
                        });
                        return;
                    }

                    newRange = {
                        start: { row, col },
                        end: { row, col },
                    };
                    break;
                }
            }

            selectionModeRef.current = mode;
            const newSelectedCells = updateSelectedCells([newRange]);
            setSelection({
                ranges: [newRange],
                selectedCells: newSelectedCells,
                isSelecting: true,
                currentRange: newRange,
            });
        },
        [selection.ranges, selection.selectedCells, data.length, columns.length]
    );

    /**
     * Unified mouse enter handler for all cell types
     * Extends selection based on current selection mode
     * @param cellType - 'data' | 'serial' | 'header'
     * @param row - Row index (-1 for header cells)
     * @param col - Column index (-1 for serial cells)
     */
    const handleMouseEnter = useCallback(
        (cellType: CellType, row: number, col: number) => {
            if (!selection.isSelecting) return;

            const totalRows = data.length;
            const totalCols = columns.length;
            if (totalRows === 0) return;

            const startRow = dragStartRef.current.row;
            const startCol = dragStartRef.current.col;
            let newRange: SelectionRange;

            switch (selectionModeRef.current) {
                case 'column': {
                    // Column mode: extend columns, keep all rows
                    // Use col from mouse position (prefer header col, fallback to data col)
                    const targetCol = cellType === 'header' ? col : col;
                    if (targetCol < 0) return;

                    const minCol = Math.min(startCol, targetCol);
                    const maxCol = Math.max(startCol, targetCol);
                    newRange = {
                        start: { row: 0, col: minCol },
                        end: { row: totalRows - 1, col: maxCol },
                    };
                    break;
                }

                case 'row': {
                    // Row mode: extend rows, keep all columns
                    // Use row from mouse position (prefer serial row, fallback to data row)
                    const targetRow = cellType === 'serial' ? row : row;
                    if (targetRow < 0 || targetRow >= totalRows) return;

                    const minRow = Math.min(startRow, targetRow);
                    const maxRow = Math.max(startRow, targetRow);
                    newRange = {
                        start: { row: minRow, col: 0 },
                        end: { row: maxRow, col: totalCols - 1 },
                    };
                    break;
                }

                case 'cell':
                default: {
                    // Cell mode: extend rectangular selection
                    if (row < 0 || col < 0) return;
                    newRange = {
                        start: { row: startRow, col: startCol },
                        end: { row, col },
                    };
                    break;
                }
            }

            const newSelectedCells = updateSelectedCells([newRange]);
            setSelection((prev) => ({
                ...prev,
                ranges: [newRange],
                selectedCells: newSelectedCells,
                currentRange: newRange,
            }));
        },
        [selection.isSelecting, data.length, columns.length]
    );

    // Handle mouse up (end selection)
    const handleMouseUp = useCallback(() => {
        setSelection((prev) => ({
            ...prev,
            isSelecting: false,
            currentRange: null,
        }));
        selectionModeRef.current = 'cell';
        dragStartRef.current = { row: -1, col: -1 };
    }, []);

    // Add global mouse up listener
    useLayoutEffect(() => {
        document.addEventListener("mouseup", handleMouseUp);
        return () => document.removeEventListener("mouseup", handleMouseUp);
    }, [handleMouseUp]);

    // Auto-scroll when selecting near edges
    useEffect(() => {
        if (!selection.isSelecting) {
            if (autoScrollAnimationRef.current) {
                cancelAnimationFrame(autoScrollAnimationRef.current);
                autoScrollAnimationRef.current = null;
            }
            lastMousePositionRef.current = null;
            return;
        }

        const SCROLL_ZONE = 50;
        const SCROLL_SPEED = 10;

        const getCellUnderMouse = (x: number, y: number): { row: number; col: number } | null => {
            if (!scrollRef.current) return null;

            const element = document.elementFromPoint(x, y);
            if (element) {
                const cellElement = element.closest('[role="cell"]');
                if (cellElement) {
                    const rowAttr = cellElement.getAttribute('data-row');
                    const colAttr = cellElement.getAttribute('data-col');
                    if (rowAttr !== null && colAttr !== null) {
                        return {
                            row: parseInt(rowAttr, 10),
                            col: parseInt(colAttr, 10),
                        };
                    }
                }
            }

            const container = scrollRef.current;
            const rect = container.getBoundingClientRect();
            const relativeX = x - rect.left + container.scrollLeft;
            const relativeY = y - rect.top + container.scrollTop;
            const HEADER_HEIGHT = 32;
            const contentY = relativeY - HEADER_HEIGHT;
            const rowIdx = Math.floor(contentY / rowHeight);

            let colIdx = -1;
            let accumulatedWidth = 0;
            for (let i = 0; i < colWidths.length; i++) {
                accumulatedWidth += colWidths[i];
                if (relativeX < accumulatedWidth) {
                    colIdx = i;
                    break;
                }
            }

            if (rowIdx >= 0 && rowIdx < data.length && colIdx >= 0 && colIdx < columns.length) {
                return { row: rowIdx, col: colIdx };
            }
            return null;
        };

        const handleGlobalMouseMove = (e: MouseEvent) => {
            if (!scrollRef.current || !selection.isSelecting) return;

            lastMousePositionRef.current = { x: e.clientX, y: e.clientY };

            const container = scrollRef.current;
            const rect = container.getBoundingClientRect();

            let scrollX = 0;
            let scrollY = 0;

            if (e.clientY < rect.top + SCROLL_ZONE) {
                scrollY = -SCROLL_SPEED;
            } else if (e.clientY > rect.bottom - SCROLL_ZONE) {
                scrollY = SCROLL_SPEED;
            }

            if (e.clientX < rect.left + SCROLL_ZONE) {
                scrollX = -SCROLL_SPEED;
            } else if (e.clientX > rect.right - SCROLL_ZONE) {
                scrollX = SCROLL_SPEED;
            }

            if (scrollX !== 0 || scrollY !== 0) {
                const scroll = () => {
                    if (!scrollRef.current || !selection.isSelecting) return;
                    container.scrollBy(scrollX, scrollY);

                    if (lastMousePositionRef.current) {
                        const cell = getCellUnderMouse(
                            lastMousePositionRef.current.x,
                            lastMousePositionRef.current.y
                        );
                        if (cell) {
                            handleMouseEnter('data', cell.row, cell.col);
                        }
                    }

                    if (selection.isSelecting) {
                        autoScrollAnimationRef.current = requestAnimationFrame(scroll);
                    }
                };

                if (!autoScrollAnimationRef.current) {
                    autoScrollAnimationRef.current = requestAnimationFrame(scroll);
                }
            } else {
                if (autoScrollAnimationRef.current) {
                    cancelAnimationFrame(autoScrollAnimationRef.current);
                    autoScrollAnimationRef.current = null;
                }
            }
        };

        document.addEventListener("mousemove", handleGlobalMouseMove);

        return () => {
            document.removeEventListener("mousemove", handleGlobalMouseMove);
            if (autoScrollAnimationRef.current) {
                cancelAnimationFrame(autoScrollAnimationRef.current);
                autoScrollAnimationRef.current = null;
            }
        };
    }, [selection.isSelecting, scrollRef, handleMouseEnter, rowHeight, colWidths, data.length, columns.length]);

    // Notify parent about selection changes
    useEffect(() => {
        const result: Array<Record<string, unknown>> = [];
        const cellsByRow = new Map<number, Set<number>>();

        selection.selectedCells.forEach((cellKey) => {
            const [rowStr, colStr] = cellKey.split("-");
            const row = parseInt(rowStr, 10);
            const col = parseInt(colStr, 10);

            if (row >= 0 && row < data.length && col >= 0 && col < columns.length) {
                if (!cellsByRow.has(row)) {
                    cellsByRow.set(row, new Set());
                }
                cellsByRow.get(row)!.add(col);
            }
        });

        cellsByRow.forEach((selectedCols, row) => {
            const rowData: Record<string, unknown> = {};
            let hasData = false;

            selectedCols.forEach((col) => {
                if (col >= 0 && col < columns.length) {
                    const columnKey = columns[col];
                    rowData[columnKey] = data[row][columnKey];
                    hasData = true;
                }
            });

            if (hasData) {
                result.push(rowData);
            }
        });

        setSelectedData(result);
        onSelectionChange(result);
    }, [selection.selectedCells, data, columns, onSelectionChange]);

    return {
        selection,
        selectedData,
        handleMouseDown,
        handleMouseEnter,
    };
}
