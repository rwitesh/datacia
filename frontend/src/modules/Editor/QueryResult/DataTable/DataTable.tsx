import {
  useState,
  useRef,
  useMemo,
  useLayoutEffect,
  useCallback,
  useEffect,
} from "react";
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  type ColumnDef,
  type ColumnResizeMode,
  type CellContext,
  type HeaderContext,
  getSortedRowModel,
  type SortingState,
} from "@tanstack/react-table";
import { useVirtualizer } from "@tanstack/react-virtual";

type DataRow = Record<string, unknown>;

// Selection types
interface CellPosition {
  row: number;
  col: number;
}

interface SelectionRange {
  start: CellPosition;
  end: CellPosition;
}

interface SelectionState {
  ranges: SelectionRange[];
  selectedCells: Set<string>; // "row-col" format for quick lookup
  isSelecting: boolean;
  currentRange: SelectionRange | null;
}

type Props = {
  columns: string[];
  data: DataRow[];
  onSelectionChange: (selected: Array<Record<string, unknown>>) => void;
  extraBlankRows?: number;
};

export function DataTable({
  columns,
  data,
  onSelectionChange,
  extraBlankRows = 5,
}: Props) {
  const [columnSizing, setColumnSizing] = useState<Record<string, number>>({});
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [containerwidth, setContainerWidth] = useState(0);
  const [containerHeight, setContainerHeight] = useState(0);
  const [sorting, setSorting] = useState<SortingState>([]);

  // Selection state
  const [selection, setSelection] = useState<SelectionState>({
    ranges: [],
    selectedCells: new Set(),
    isSelecting: false,
    currentRange: null,
  });

  // const [showSelectionData, setShowSelectionData] = useState(false);

  // Track container size
  useLayoutEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver(([entry]) => {
      setContainerWidth(entry.contentRect.width);
      setContainerHeight(entry.contentRect.height);
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  // Helper function to create cell key
  const createCellKey = useCallback(
    (row: number, col: number) => `${row}-${col}`,
    []
  );

  // Helper function to check if cell is selected
  const isCellSelected = useCallback(
    (row: number, col: number) => {
      return selection.selectedCells.has(createCellKey(row, col));
    },
    [selection.selectedCells, createCellKey]
  );

  // Helper function to get cells in a range
  const getCellsInRange = useCallback(
    (start: CellPosition, end: CellPosition): Set<string> => {
      const cells = new Set<string>();
      const minRow = Math.min(start.row, end.row);
      const maxRow = Math.max(start.row, end.row);
      const minCol = Math.min(start.col, end.col);
      const maxCol = Math.max(start.col, end.col);

      for (let row = minRow; row <= maxRow; row++) {
        for (let col = minCol; col <= maxCol; col++) {
          cells.add(createCellKey(row, col));
        }
      }
      return cells;
    },
    [createCellKey]
  );

  // Update selected cells based on ranges
  const updateSelectedCells = useCallback(
    (ranges: SelectionRange[]) => {
      const allSelectedCells = new Set<string>();
      ranges.forEach((range) => {
        const cellsInRange = getCellsInRange(range.start, range.end);
        cellsInRange.forEach((cell) => allSelectedCells.add(cell));
      });
      return allSelectedCells;
    },
    [getCellsInRange]
  );

  // Handle mouse down on cell
  const handleCellMouseDown = useCallback(
    (row: number, col: number, event: React.MouseEvent) => {
      event.preventDefault();

      const newPosition: CellPosition = { row, col };

      if (event.ctrlKey || event.metaKey) {
        // Ctrl+Click: Add new range or toggle single cell
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
        // Regular click: Start new selection
        const newRange: SelectionRange = {
          start: newPosition,
          end: newPosition,
        };
        setSelection({
          ranges: [newRange],
          selectedCells: new Set([createCellKey(row, col)]),
          isSelecting: true,
          currentRange: newRange,
        });
      }
    },
    [selection.ranges, updateSelectedCells, createCellKey]
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
    [
      selection.isSelecting,
      selection.currentRange,
      selection.ranges,
      updateSelectedCells,
    ]
  );

  // Handle mouse up (end selection)
  const handleMouseUp = useCallback(() => {
    setSelection((prev) => ({
      ...prev,
      isSelecting: false,
      currentRange: null,
    }));
  }, []);

  // Add mouse up listener to document
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
    [data.length, selection.ranges, updateSelectedCells]
  );

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

  onSelectionChange(selectedData);
}, [selection, data, columns, onSelectionChange]);


  // Clear selection
  // const clearSelection = useCallback(() => {
  //   setSelection({
  //     ranges: [],
  //     selectedCells: new Set(),
  //     isSelecting: false,
  //     currentRange: null
  //   });
  // }, []);

  // Generate Column Definitions
  const columnDefs = useMemo<ColumnDef<DataRow>[]>(() => {
    const baseColumns = columns.map((colKey) => {
      return {
        id: colKey,
        accessorFn: (row: DataRow) => row[colKey],
        header: colKey,
        cell: (info: CellContext<DataRow, unknown>) => {
          const value = info.getValue();
          if (value === null || value === undefined) return "NULL";
          if (typeof value === "object") return JSON.stringify(value);
          return String(value);
        },
      };
    });

    return baseColumns;
  }, [columns]);

  const table = useReactTable({
    data,
    columns: columnDefs,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    columnResizeMode: "onChange" as ColumnResizeMode,
    state: { columnSizing, sorting },
    onColumnSizingChange: setColumnSizing,
    onSortingChange: setSorting,
    enableMultiRowSelection: true,
  });

  const rows = table.getRowModel().rows;
  const headers = table.getFlatHeaders();
  let colWidths = headers.map((h) => Math.max(40, Math.floor(h.getSize())));
  let totalWidth = colWidths.reduce((a, b) => a + b, 0);
  const rowHeight = 24;

  // Stretch columns to fill container proportionally if total width < container width
  if (containerwidth > totalWidth && colWidths.length > 0) {
    const extraSpace = containerwidth - totalWidth;
    const extraPerCol = extraSpace / colWidths.length;
    colWidths = colWidths.map((w) => w + extraPerCol);
    totalWidth = containerwidth;
  }

  const gridTemplateColumns = useMemo(
    () => colWidths.map((w) => `${w}px`).join(" "),
    [colWidths]
  );

  // Calculate total rows including extra blank rows
  const totalRows = rows.length + extraBlankRows;

  // Virtualize Rows (including extra blank rows)
  const rowVirtualizer = useVirtualizer({
    count: totalRows,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => rowHeight,
    overscan: 10,
  });

  // Calculate additional filler rows to fill remaining height
  const visibleHeight = rowVirtualizer.getTotalSize();
  const additionalFillerRows =
    containerHeight > visibleHeight
      ? Math.ceil((containerHeight - visibleHeight) / rowHeight)
      : 0;

  if (!columns.length) {
    return (
      <div className="p-3 text-muted-foreground text-xs">
        No columns to display.
      </div>
    );
  }

  return (
    <div className="h-full w-full overflow-hidden">
      <div
        ref={(el) => {
          scrollRef.current = el;
          containerRef.current = el;
        }}
        className="h-full w-full overflow-auto"
        style={{ contain: "strict" }}
      >
        <div className="sticky top-0 z-10 bg-muted">
          <table
            className="table-fixed border-separate border-spacing-0 text-xs cursor-default select-none"
            style={{ width: totalWidth }}
          >
            <thead>
              {table.getHeaderGroups().map((headerGroup) => (
                <tr key={headerGroup.id}>
                  {headerGroup.headers.map((header, i) => (
                    <th
                      key={header.id}
                      colSpan={header.colSpan}
                      style={{ width: colWidths[i] }}
                      className="relative border border-border bg-muted px-2 py-1 font-medium hover:bg-blue-500/20 hover:border-blue-500 transition-colors"
                      onClick={(e) => {
                        // Check if click is on resize handle
                        const rect = e.currentTarget.getBoundingClientRect();
                        const isResizeArea = e.clientX > rect.right - 10;

                        if (!isResizeArea) {
                          handleColumnHeaderClick(i, e);
                        } else {
                          header.column.getToggleSortingHandler()?.(e);
                        }
                      }}
                    >
                      <div className="flex items-center justify-center h-full gap-2">
                        <span className="overflow-hidden text-ellipsis whitespace-nowrap">
                          {flexRender(
                            header.column.columnDef.header,
                            header.getContext() as HeaderContext<
                              DataRow,
                              unknown
                            >
                          )}
                        </span>
                        {header.column.getCanSort() && (
                          <span>
                            {header.column.getIsSorted() === "asc" && (
                              <span>▲</span>
                            )}
                            {header.column.getIsSorted() === "desc" && (
                              <span>▼</span>
                            )}
                          </span>
                        )}
                      </div>
                      {header.column.getCanResize() && (
                        <div
                          onMouseDown={header.getResizeHandler()}
                          onTouchStart={header.getResizeHandler()}
                          className="absolute right-0 top-0 h-full w-2 cursor-col-resize bg-transparent hover:bg-blue-500/30"
                        />
                      )}
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
          </table>
        </div>
        <div
          className="relative"
          style={{
            width: totalWidth,
            height:
              rowVirtualizer.getTotalSize() + additionalFillerRows * rowHeight,
          }}
        >
          {rowVirtualizer.getVirtualItems().map((vi) => {
            const isDataRow = vi.index < rows.length;
            const row = isDataRow ? rows[vi.index] : null;
            const even = vi.index % 2 === 0;

            return (
              <div
                key={isDataRow ? row!.id : `blank-row-${vi.index}`}
                role="row"
                className={`${even ? "bg-muted" : "bg-background"}`}
                style={{
                  position: "absolute",
                  insetInlineStart: 0,
                  transform: `translateY(${vi.start}px)`,
                  width: totalWidth,
                  height: vi.size,
                  display: "grid",
                  gridTemplateColumns,
                }}
              >
                {isDataRow
                  ? // Render data row
                    row!.getVisibleCells().map((cell, ci) => {
                      const isSelected = isCellSelected(vi.index, ci);
                      return (
                        <div
                          key={cell.id}
                          role="cell"
                          className={`relative border border-border px-2 cursor-pointer transition-colors ${
                            isSelected
                              ? "bg-blue-500/30 border-blue-600 border-2"
                              : "hover:bg-blue-500/10 hover:border-blue-500"
                          }`}
                          style={{ width: colWidths[ci] }}
                          onMouseDown={(e) =>
                            handleCellMouseDown(vi.index, ci, e)
                          }
                          onMouseEnter={() =>
                            handleCellMouseEnter(vi.index, ci)
                          }
                        >
                          <div className="overflow-hidden text-ellipsis whitespace-nowrap text-xs h-full flex items-center cursor-default select-none">
                            {flexRender(
                              cell.column.columnDef.cell,
                              cell.getContext()
                            )}
                          </div>
                        </div>
                      );
                    })
                  : // Render blank row
                    colWidths.map((w, ci) => (
                      <div
                        key={`blank-cell-${vi.index}-${ci}`}
                        role="cell"
                        className="relative border-r border-border px-2"
                        style={{ width: w }}
                      >
                        <div className="h-full flex items-center cursor-default select-none">
                          {/* Empty content for blank rows */}
                        </div>
                      </div>
                    ))}
              </div>
            );
          })}

          {/* Additional filler rows */}
          {additionalFillerRows > 0 &&
            Array.from({ length: additionalFillerRows }).map((_, idx) => {
              const top = rowVirtualizer.getTotalSize() + idx * rowHeight;
              const isEven = (totalRows + idx) % 2 === 0;
              return (
                <div
                  key={`filler-${idx}`}
                  role="row"
                  className={isEven ? "bg-muted" : "bg-background"}
                  style={{
                    position: "absolute",
                    insetInlineStart: 0,
                    transform: `translateY(${top}px)`,
                    width: totalWidth,
                    height: rowHeight,
                    display: "grid",
                    gridTemplateColumns,
                  }}
                >
                  {colWidths.map((w, ci) => (
                    <div
                      key={`filler-cell-${ci}`}
                      style={{ width: w }}
                      className="border-r border-border"
                    />
                  ))}
                </div>
              );
            })}
        </div>
      </div>
    </div>
  );
}
