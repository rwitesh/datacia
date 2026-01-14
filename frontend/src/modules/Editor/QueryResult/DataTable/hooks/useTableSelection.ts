import React, { useState, useCallback, useLayoutEffect, useEffect, useRef } from "react";
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

            if (event.shiftKey && selection.ranges.length > 0) {
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
        [selection.ranges, selection.selectedCells]
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

        const SCROLL_ZONE = 50; // pixels from edge to trigger scroll
        const SCROLL_SPEED = 10; // pixels per frame

        const getCellUnderMouse = (x: number, y: number): { row: number; col: number } | null => {
            if (!scrollRef.current) return null;

            // First, try to find an actual cell element under the mouse
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

            // If no cell found, calculate position based on scroll and mouse coordinates
            const container = scrollRef.current;
            const rect = container.getBoundingClientRect();
            
            // Calculate relative position within the scrollable area
            const relativeX = x - rect.left + container.scrollLeft;
            const relativeY = y - rect.top + container.scrollTop;
            
            // Account for header height (approximately 32px)
            const HEADER_HEIGHT = 32;
            const contentY = relativeY - HEADER_HEIGHT;
            
            // Calculate row and column indices
            const row = Math.floor(contentY / rowHeight);
            
            let col = -1;
            let accumulatedWidth = 0;
            for (let i = 0; i < colWidths.length; i++) {
                accumulatedWidth += colWidths[i];
                if (relativeX < accumulatedWidth) {
                    col = i;
                    break;
                }
            }
            
            // Validate the calculated indices
            if (row >= 0 && row < data.length && col >= 0 && col < columns.length) {
                return { row, col };
            }

            return null;
        };

        const handleMouseMove = (e: MouseEvent) => {
            if (!scrollRef.current || !selection.isSelecting) return;

            // Store the current mouse position
            lastMousePositionRef.current = { x: e.clientX, y: e.clientY };

            const container = scrollRef.current;
            const rect = container.getBoundingClientRect();

            let scrollX = 0;
            let scrollY = 0;

            // Check vertical edges
            if (e.clientY < rect.top + SCROLL_ZONE) {
                scrollY = -SCROLL_SPEED;
            } else if (e.clientY > rect.bottom - SCROLL_ZONE) {
                scrollY = SCROLL_SPEED;
            }

            // Check horizontal edges
            if (e.clientX < rect.left + SCROLL_ZONE) {
                scrollX = -SCROLL_SPEED;
            } else if (e.clientX > rect.right - SCROLL_ZONE) {
                scrollX = SCROLL_SPEED;
            }

            // Perform scroll if needed
            if (scrollX !== 0 || scrollY !== 0) {
                const scroll = () => {
                    if (!scrollRef.current || !selection.isSelecting) return;
                    
                    container.scrollBy(scrollX, scrollY);
                    
                    // Update selection based on cell under mouse
                    if (lastMousePositionRef.current) {
                        const cell = getCellUnderMouse(
                            lastMousePositionRef.current.x,
                            lastMousePositionRef.current.y
                        );
                        if (cell) {
                            handleCellMouseEnter(cell.row, cell.col);
                        }
                    }
                    
                    // Continue scrolling while mouse is in scroll zone
                    if (selection.isSelecting) {
                        autoScrollAnimationRef.current = requestAnimationFrame(scroll);
                    }
                };
                
                if (!autoScrollAnimationRef.current) {
                    autoScrollAnimationRef.current = requestAnimationFrame(scroll);
                }
            } else {
                // Stop scrolling if mouse is not in scroll zone
                if (autoScrollAnimationRef.current) {
                    cancelAnimationFrame(autoScrollAnimationRef.current);
                    autoScrollAnimationRef.current = null;
                }
            }
        };

        document.addEventListener("mousemove", handleMouseMove);
        
        return () => {
            document.removeEventListener("mousemove", handleMouseMove);
            if (autoScrollAnimationRef.current) {
                cancelAnimationFrame(autoScrollAnimationRef.current);
                autoScrollAnimationRef.current = null;
            }
        };
    }, [selection.isSelecting, scrollRef, handleCellMouseEnter, rowHeight, colWidths, data.length, columns.length]);

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

            // Select only this column
            const newSelectedCells = updateSelectedCells([columnRange]);
            setSelection({
                ranges: [columnRange],
                selectedCells: newSelectedCells,
                isSelecting: false,
                currentRange: null,
            });
        },
        [data.length]
    );

    // Notify parent about selection changes
    useEffect(() => {
        const selectedData: Array<Record<string, unknown>> = [];

        // Group selected cells by row
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

        // Build selectedData with only selected cells
        cellsByRow.forEach((selectedCols, row) => {
            const rowData: Record<string, unknown> = {};
            let hasData = false;

            // Only include columns that are actually selected
            selectedCols.forEach((col) => {
                if (col >= 0 && col < columns.length) {
                    const columnKey = columns[col];
                    rowData[columnKey] = data[row][columnKey];
                    hasData = true;
                }
            });

            if (hasData) {
                selectedData.push(rowData);
            }
        });

        setSelectedData(selectedData);
        onSelectionChange(selectedData);
    }, [selection.selectedCells, data, columns, onSelectionChange]);

    return {
        selection,
        selectedData,
        handleCellMouseDown,
        handleCellMouseEnter,
        handleColumnHeaderClick,
    };
}
