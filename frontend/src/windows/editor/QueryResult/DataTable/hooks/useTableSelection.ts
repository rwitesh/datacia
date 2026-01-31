import React, { useState, useCallback, useLayoutEffect, useEffect, useRef } from "react";
import {
    type SelectionState,
    type SelectionGeometry,
    createSelectionGeometry,
    isCellInSelection,
} from "../utils/cellSelection";

export type CellType = 'data' | 'serial' | 'header';

type SelectionMode = 'cell' | 'row' | 'column';

interface UseTableSelectionProps {
    columns: string[];
    data: Array<Record<string, unknown>>;
    onSelectionChange: (selection: SelectionGeometry | null) => void;
    scrollRef: React.RefObject<HTMLDivElement | null>;
    rowHeight: number;
    colWidths: number[];
    initialSelection?: SelectionGeometry | null;
}

export function useTableSelection({
    columns,
    data,
    onSelectionChange,
    scrollRef,
    rowHeight,
    colWidths,
    initialSelection,
}: UseTableSelectionProps) {
    const [selection, setSelection] = useState<SelectionState>(() => ({
        geometry: initialSelection ?? null,
        isSelecting: false,
    }));

    const autoScrollAnimationRef = useRef<number | null>(null);
    const lastMousePositionRef = useRef<{ x: number; y: number } | null>(null);
    const selectionModeRef = useRef<SelectionMode>('cell');
    const dragStartRef = useRef<{ row: number; col: number }>({ row: -1, col: -1 });

    const handleMouseDown = useCallback(
        (cellType: CellType, row: number, col: number, event: React.MouseEvent) => {
            if (event.button === 2) {
                if (isCellInSelection(selection.geometry, row, col)) {
                    return;
                }
            }

            event.preventDefault();

            const totalRows = data.length;
            const totalCols = columns.length;
            if (totalRows === 0) return;

            let newGeometry: SelectionGeometry;
            let mode: SelectionMode;

            switch (cellType) {
                case 'header': {
                    mode = 'column';
                    dragStartRef.current = { row: -1, col };
                    newGeometry = createSelectionGeometry(0, col, totalRows - 1, col);
                    break;
                }

                case 'serial': {
                    mode = 'row';
                    dragStartRef.current = { row, col: -1 };
                    newGeometry = createSelectionGeometry(row, 0, row, totalCols - 1);
                    break;
                }

                case 'data':
                default: {
                    mode = 'cell';
                    dragStartRef.current = { row, col };

                    if (event.shiftKey && selection.geometry) {
                        const { topLeft } = selection.geometry;
                        newGeometry = createSelectionGeometry(topLeft.row, topLeft.col, row, col);
                        setSelection({
                            geometry: newGeometry,
                            isSelecting: false,
                        });
                        return;
                    }

                    const isSameCell =
                        selection.geometry &&
                        selection.geometry.topLeft.row === row &&
                        selection.geometry.topLeft.col === col &&
                        selection.geometry.bottomRight.row === row &&
                        selection.geometry.bottomRight.col === col;

                    if (isSameCell) {
                        setSelection({
                            geometry: null,
                            isSelecting: false,
                        });
                        return;
                    }

                    newGeometry = createSelectionGeometry(row, col, row, col);
                    break;
                }
            }

            selectionModeRef.current = mode;
            setSelection({
                geometry: newGeometry,
                isSelecting: true,
            });
        },
        [selection.geometry, data.length, columns.length]
    );

    const handleMouseEnter = useCallback(
        (cellType: CellType, row: number, col: number) => {
            if (!selection.isSelecting) return;

            const totalRows = data.length;
            const totalCols = columns.length;
            if (totalRows === 0) return;

            const startRow = dragStartRef.current.row;
            const startCol = dragStartRef.current.col;
            let newGeometry: SelectionGeometry;

            switch (selectionModeRef.current) {
                case 'column': {
                    const targetCol = cellType === 'header' ? col : col;
                    if (targetCol < 0) return;
                    newGeometry = createSelectionGeometry(0, startCol, totalRows - 1, targetCol);
                    break;
                }

                case 'row': {
                    const targetRow = cellType === 'serial' ? row : row;
                    if (targetRow < 0 || targetRow >= totalRows) return;
                    newGeometry = createSelectionGeometry(startRow, 0, targetRow, totalCols - 1);
                    break;
                }

                case 'cell':
                default: {
                    if (row < 0 || col < 0) return;
                    newGeometry = createSelectionGeometry(startRow, startCol, row, col);
                    break;
                }
            }

            setSelection((prev) => ({
                ...prev,
                geometry: newGeometry,
            }));
        },
        [selection.isSelecting, data.length, columns.length]
    );

    const handleMouseUp = useCallback(() => {
        setSelection((prev) => ({
            ...prev,
            isSelecting: false,
        }));
        selectionModeRef.current = 'cell';
        dragStartRef.current = { row: -1, col: -1 };
    }, []);

    useLayoutEffect(() => {
        document.addEventListener("mouseup", handleMouseUp);
        return () => document.removeEventListener("mouseup", handleMouseUp);
    }, [handleMouseUp]);

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

    useEffect(() => {
        onSelectionChange(selection.geometry);
    }, [selection.geometry, onSelectionChange]);

    return {
        selection: selection.geometry,
        handleMouseDown,
        handleMouseEnter,
    };
}
