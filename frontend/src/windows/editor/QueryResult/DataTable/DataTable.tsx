import { useEffect, useImperativeHandle, useMemo, useRef, useState, type CSSProperties, type Ref, type SyntheticEvent } from "react";
import {
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnSizingState,
  type OnChangeFn,
  type SortingState,
} from "@tanstack/react-table";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useTheme } from "@/components/theme";
import { useExportActions } from "@/services/useExportActions";
import type { DataRow } from "./types";
import { type CellSelection, getSelectedData, getSelectionBounds } from "./utils/cellSelection";
import { fillContainer, FONT_SIZE, HEADER_HEIGHT, measureColumnWidths, MIN_COLUMN_WIDTH, ROW_HEIGHT } from "./utils/layout";
import { useTableDimensions } from "./hooks/useTableDimensions";
import { useTableColumns } from "./hooks/useTableColumns";
import { useTableSelection } from "./hooks/useTableSelection";
import { TableHeader } from "./components/TableHeader";
import { TableRow } from "./components/TableRow";
import { TableContextMenu } from "./components/TableContextMenu";

interface DataTableProps {
  // The scroll container, used by the result bar's PNG export.
  ref?: Ref<HTMLDivElement>;
  columns: string[];
  data: DataRow[];
  // selectedRows are the rows the selection covers, in the order shown,
  // holding only the selected columns.
  onSelectionChange: (selection: CellSelection | null, selectedRows: DataRow[]) => void;
  // Set for table tabs, which sort in the database; otherwise sorting is client-side.
  // An empty column clears the sort.
  onServerSort?: (column: string, direction: "asc" | "desc") => void;
  currentOrderBy?: string;
  currentOrderDir?: "asc" | "desc";
  isLoading?: boolean;
  onOpenDataView?: () => void;
  scrollPosition?: { left: number; top: number };
  onScrollChange?: (scroll: { left: number; top: number }) => void;
  // Rows before this page, for row numbers.
  offset?: number;
  initialSelection?: CellSelection | null;
}

export function DataTable({
  ref,
  columns,
  data,
  onSelectionChange,
  onServerSort,
  currentOrderBy,
  currentOrderDir,
  isLoading = false,
  onOpenDataView,
  scrollPosition,
  onScrollChange,
  offset = 0,
  initialSelection,
}: DataTableProps) {
  const { editorFontFamily } = useTheme();
  const scrollRef = useRef<HTMLDivElement>(null);
  useImperativeHandle(ref, () => scrollRef.current as HTMLDivElement, []);

  // Restore the tab's saved scroll once on mount. The latest position lives
  // in a ref and is saved back on unmount (tab switch), so scrolling doesn't
  // write to the editor context on every frame.
  const lastScrollRef = useRef(scrollPosition);
  const onScrollChangeRef = useRef(onScrollChange);
  useEffect(() => {
    onScrollChangeRef.current = onScrollChange;
  }, [onScrollChange]);
  useEffect(() => {
    const scroller = scrollRef.current;
    if (scroller && lastScrollRef.current) {
      scroller.scrollLeft = lastScrollRef.current.left;
      scroller.scrollTop = lastScrollRef.current.top;
    }
    return () => {
      if (lastScrollRef.current) onScrollChangeRef.current?.(lastScrollRef.current);
    };
  }, []);

  // Canvas silently measures with a fallback font until a web font has
  // loaded, so widths use the editor font only once it is ready.
  const [loadedFont, setLoadedFont] = useState<string | null>(null);
  useEffect(() => {
    document.fonts.load(`${FONT_SIZE}px ${editorFontFamily}`).then(() => setLoadedFont(editorFontFamily));
  }, [editorFontFamily]);

  const { containerWidth, containerHeight } = useTableDimensions(scrollRef);
  const contentWidths = useMemo(
    () => measureColumnWidths(columns, data, offset + data.length, loadedFont ?? "monospace"),
    [columns, data, offset, loadedFont]
  );
  const initialWidths = useMemo(
    () => fillContainer(contentWidths, containerWidth),
    [contentWidths, containerWidth]
  );
  const columnDefs = useTableColumns(columns, initialWidths);

  const [columnSizing, setColumnSizing] = useState<ColumnSizingState>({});
  const [clientSorting, setClientSorting] = useState<SortingState>([]);
  const isServerSort = onServerSort !== undefined;
  const sorting = useMemo<SortingState>(() => {
    if (!isServerSort) return clientSorting;
    return currentOrderBy ? [{ id: currentOrderBy, desc: currentOrderDir === "desc" }] : [];
  }, [isServerSort, clientSorting, currentOrderBy, currentOrderDir]);
  const handleSortingChange: OnChangeFn<SortingState> = (updater) => {
    const next = typeof updater === "function" ? updater(sorting) : updater;
    if (!onServerSort) {
      setClientSorting(next);
      return;
    }
    const [first] = next;
    onServerSort(first?.id ?? "", first?.desc ? "desc" : "asc");
  };

  const table = useReactTable({
    data,
    columns: columnDefs,
    state: { sorting, columnSizing },
    onSortingChange: handleSortingChange,
    onColumnSizingChange: setColumnSizing,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    manualSorting: isServerSort,
    sortDescFirst: true,
    enableMultiSort: !isServerSort,
    columnResizeMode: "onChange",
  });

  const rows = table.getRowModel().rows;
  // Selection indices are positions in the (possibly sorted) view.
  const viewRows = useMemo(() => rows.map((row) => row.original), [rows]);
  const headers = table.getFlatHeaders();

  // What each header's getSize() returns, derived from state so it can be
  // memoized: the selection hook's drag effect depends on columnEdges.
  const columnWidths = useMemo(
    () =>
      columnDefs.map((column) =>
        Math.max(columnSizing[column.id!] ?? column.size!, MIN_COLUMN_WIDTH)
      ),
    [columnDefs, columnSizing]
  );
  const columnEdges = useMemo(() => {
    const edges = [0];
    for (const width of columnWidths) edges.push(edges[edges.length - 1] + width);
    return edges;
  }, [columnWidths]);
  const totalWidth = columnEdges[columnEdges.length - 1];

  const { selection, isDragging, handleMouseDown, handleKeyDown } = useTableSelection({
    data,
    colCount: columns.length,
    columnEdges,
    scrollRef,
    initialSelection,
  });

  // Built once a drag ends rather than on every cell the pointer crosses.
  const selected = useMemo(
    () => (isDragging ? null : getSelectedData(selection, columns, viewRows)),
    [isDragging, selection, columns, viewRows]
  );
  useEffect(() => {
    if (selected) onSelectionChange(selection, selected.rows);
  }, [selected, selection, onSelectionChange]);

  const { copyText } = useExportActions({
    data: selected?.rows ?? [],
    columns: selected?.columns ?? [],
  });

  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 10,
  });
  const rowsHeight = rowVirtualizer.getTotalSize();
  // Empty space below the last row keeps the column lines down to the bottom.
  const bodyHeight = Math.max(rowsHeight, containerHeight - HEADER_HEIGHT);
  const bounds = selection && getSelectionBounds(selection);

  const gridStyle = {
    "--grid-columns": columnWidths.map((width) => `${width}px`).join(" "),
    "--grid-width": `${totalWidth}px`,
    fontFamily: editorFontFamily,
  } as CSSProperties;

  return (
    <div className="relative h-full w-full bg-background">
      <div
        ref={scrollRef}
        tabIndex={0}
        className="h-full w-full cursor-default select-none overflow-auto text-xs outline-none"
        style={{ ...gridStyle, contain: "strict" }}
        onMouseDown={(event) => {
          if (isFromGrid(event)) handleMouseDown(event);
        }}
        onKeyDown={(event) => {
          if (!isFromGrid(event)) return;
          if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "c") {
            event.preventDefault();
            copyText();
            return;
          }
          handleKeyDown(event);
        }}
        onScroll={(event) => {
          lastScrollRef.current = {
            left: event.currentTarget.scrollLeft,
            top: event.currentTarget.scrollTop,
          };
        }}
      >
        {columns.length === 0 ? (
          <div className="p-3 text-muted-foreground">No columns to display.</div>
        ) : (
          <>
            <TableHeader headers={headers} />
            <TableContextMenu
              rows={selected?.rows ?? []}
              columns={selected?.columns ?? []}
              onOpenDataView={onOpenDataView}
            >
              <div className="relative" style={{ width: totalWidth, height: bodyHeight }}>
                {/* Drawn under the rows, whose cells are transparent; the
                    opaque row-number column covers it when scrolled. */}
                {bounds && (
                  <div
                    className="pointer-events-none absolute border-2 border-blue-600 bg-blue-500/20"
                    style={{
                      top: bounds.top * ROW_HEIGHT,
                      height: (bounds.bottom - bounds.top + 1) * ROW_HEIGHT,
                      left: columnEdges[bounds.left + 1],
                      width: columnEdges[bounds.right + 2] - columnEdges[bounds.left + 1],
                    }}
                  />
                )}
                {rowVirtualizer.getVirtualItems().map((item) => (
                  <TableRow
                    key={rows[item.index].id}
                    row={rows[item.index]}
                    index={item.index}
                    top={item.start}
                    rowNumber={offset + item.index + 1}
                  />
                ))}
                {bodyHeight > rowsHeight && (
                  <div
                    className="absolute left-0 grid"
                    style={{
                      top: rowsHeight,
                      height: bodyHeight - rowsHeight,
                      width: totalWidth,
                      gridTemplateColumns: "var(--grid-columns)",
                    }}
                  >
                    {columnWidths.map((_, index) => (
                      <div
                        key={index}
                        className={
                          index === 0
                            ? "sticky left-0 border-r-[0.5px] border-border/60 bg-muted"
                            : "border-r-[0.5px] border-border/60"
                        }
                      />
                    ))}
                  </div>
                )}
              </div>
            </TableContextMenu>
          </>
        )}
      </div>
      {isLoading && (
        <div
          className="absolute inset-x-0 bottom-0 z-30 flex items-center justify-center bg-background/60"
          style={{ top: HEADER_HEIGHT }}
        >
          <div className="h-6 w-6 animate-spin rounded-full border-b-2 border-primary" />
        </div>
      )}
    </div>
  );
}

// React bubbles events from portals (the context menu) through the component
// tree, so the grid ignores events whose target is outside its own DOM.
function isFromGrid(event: SyntheticEvent) {
  return event.currentTarget.contains(event.target as Node);
}
