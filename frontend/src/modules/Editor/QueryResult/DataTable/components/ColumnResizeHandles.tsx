import { memo } from "react";

interface ColumnResizeHandlesProps {
    colWidths: number[];
    totalHeight: number;
    onResizeStart: (colIndex: number, startX: number) => void;
    isResizing: boolean;
}

/**
 * Full-height column resize handles that overlay the entire table body.
 * Allows users to resize columns by dragging at any vertical position.
 */
export const ColumnResizeHandles = memo(function ColumnResizeHandles({
    colWidths,
    totalHeight,
    onResizeStart,
    isResizing,
}: ColumnResizeHandlesProps) {
    // Calculate the left positions for each column border
    let accumulatedWidth = 0;
    const handlePositions = colWidths.map((width) => {
        accumulatedWidth += width;
        return accumulatedWidth;
    });

    return (
        <div
            className="absolute inset-0 pointer-events-none z-20"
            style={{ height: totalHeight }}
        >
            {handlePositions.slice(0, -1).map((leftPos, index) => (
                <div
                    key={`resize-handle-${index}`}
                    className={`
            absolute top-0 pointer-events-auto
            ${isResizing ? "cursor-col-resize" : "cursor-col-resize"}
            group
          `}
                    style={{
                        left: leftPos - 4,
                        width: 8,
                        height: totalHeight,
                    }}
                    onMouseDown={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        onResizeStart(index, e.clientX);
                    }}
                >
                    {/* Visible hover indicator - the thin line */}
                    <div
                        className={`
              absolute inset-y-0 left-1/2 -translate-x-1/2 w-[2px]
              transition-colors duration-100
              ${isResizing ? "bg-blue-500" : "bg-transparent group-hover:bg-blue-500/50"}
            `}
                    />
                </div>
            ))}
        </div>
    );
});
