import { useState, useCallback, useRef } from "react";

interface UseColumnResizeProps {
    columns: string[];
    baseWidths: number[];
    onResizing?: (isResizing: boolean) => void;
}

interface UseColumnResizeReturn {
    columnWidths: number[];
    isResizing: boolean;
    startResize: (colIndex: number, startX: number) => void;
    handleResizeMove: (clientX: number) => void;
    handleResizeEnd: () => void;
    resetColumnWidth: (colIndex: number) => void;
}

/**
 * Custom hook for managing column resize state and interactions.
 * Allows users to resize columns by dragging the column border.
 */
export function useColumnResize({
    columns,
    baseWidths,
    onResizing,
}: UseColumnResizeProps): UseColumnResizeReturn {
    // Track user-resized column widths (delta from base width)
    const [resizeDeltas, setResizeDeltas] = useState<Record<string, number>>({});
    const [isResizing, setIsResizing] = useState(false);

    // Resize state refs for mouse event handling
    const resizeState = useRef<{
        colIndex: number;
        startX: number;
        startWidth: number;
    } | null>(null);

    // Calculate final column widths by applying deltas to base widths
    const columnWidths = baseWidths.map((baseWidth, index) => {
        const columnName = columns[index];
        const delta = resizeDeltas[columnName] || 0;
        return Math.max(40, baseWidth + delta); // Minimum width of 40px
    });

    const startResize = useCallback(
        (colIndex: number, startX: number) => {
            resizeState.current = {
                colIndex,
                startX,
                startWidth: columnWidths[colIndex],
            };
            setIsResizing(true);
            onResizing?.(true);

            // Add document-level event listeners for drag
            const handleMouseMove = (e: MouseEvent) => {
                if (!resizeState.current) return;

                const deltaX = e.clientX - resizeState.current.startX;
                const newWidth = Math.max(40, resizeState.current.startWidth + deltaX);
                const columnName = columns[resizeState.current.colIndex];

                setResizeDeltas((prev) => ({
                    ...prev,
                    [columnName]: newWidth - baseWidths[resizeState.current!.colIndex],
                }));
            };

            const handleMouseUp = () => {
                resizeState.current = null;
                setIsResizing(false);
                onResizing?.(false);
                document.removeEventListener("mousemove", handleMouseMove);
                document.removeEventListener("mouseup", handleMouseUp);
            };

            document.addEventListener("mousemove", handleMouseMove);
            document.addEventListener("mouseup", handleMouseUp);
        },
        [columns, baseWidths, columnWidths, onResizing]
    );

    const handleResizeMove = useCallback((clientX: number) => {
        if (!resizeState.current) return;

        const deltaX = clientX - resizeState.current.startX;
        const newWidth = Math.max(40, resizeState.current.startWidth + deltaX);
        const columnName = columns[resizeState.current.colIndex];

        setResizeDeltas((prev) => ({
            ...prev,
            [columnName]: newWidth - baseWidths[resizeState.current!.colIndex],
        }));
    }, [columns, baseWidths]);

    const handleResizeEnd = useCallback(() => {
        resizeState.current = null;
        setIsResizing(false);
        onResizing?.(false);
    }, [onResizing]);

    const resetColumnWidth = useCallback((colIndex: number) => {
        const columnName = columns[colIndex];
        setResizeDeltas((prev) => {
            const next = { ...prev };
            delete next[columnName];
            return next;
        });
    }, [columns]);

    return {
        columnWidths,
        isResizing,
        startResize,
        handleResizeMove,
        handleResizeEnd,
        resetColumnWidth,
    };
}
