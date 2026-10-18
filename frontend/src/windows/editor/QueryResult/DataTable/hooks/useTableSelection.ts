import { useEffect, useRef, useState, type KeyboardEvent, type MouseEvent, type RefObject } from "react";
import type { CellPosition, CellSelection } from "@/context/editor/Context";
import { isCellSelected, isSelectionInGrid } from "../utils/cellSelection";
import { HEADER_HEIGHT, ROW_HEIGHT } from "../utils/layout";

// How a press started: on a cell, a row number or a column header. Dragging
// keeps the same kind, so dragging across row numbers selects whole rows.
type SelectionMode = "cell" | "row" | "column";

// Autoscroll starts this close to the visible edge while drag-selecting.
const AUTOSCROLL_EDGE = 12;

interface UseTableSelectionOptions {
  // Changes identity when a new result or page arrives, which clears the selection.
  data: unknown[];
  colCount: number;
  // Left edge of every grid column (row-number column first) plus the right
  // edge of the last one, in px from the grid's left edge.
  columnEdges: number[];
  scrollRef: RefObject<HTMLDivElement | null>;
  initialSelection?: CellSelection;
}

// useTableSelection implements spreadsheet-style range selection: click,
// drag (with autoscroll), Shift+click, row and column headers, select all,
// and keyboard navigation. Cells are found from data-row / data-col
// attributes (header cells have no data-row; the row-number column is -1).
export function useTableSelection({
  data,
  colCount,
  columnEdges,
  scrollRef,
  initialSelection,
}: UseTableSelectionOptions) {
  const rowCount = data.length;
  const last: CellPosition = { row: rowCount - 1, col: colCount - 1 };
  const [selection, setSelection] = useState<CellSelection | null>(() =>
    isSelectionInGrid(initialSelection, rowCount, colCount) ? initialSelection : null
  );
  const [drag, setDrag] = useState<{ mode: SelectionMode; from: CellPosition } | null>(null);
  const pointerRef = useRef<{ x: number; y: number } | null>(null);

  const [selectionData, setSelectionData] = useState(data);
  if (data !== selectionData) {
    setSelectionData(data);
    setSelection(null);
    setDrag(null);
  }

  const lastRow = last.row;
  const lastCol = last.col;
  useEffect(() => {
    if (!drag) return;
    let frame = 0;

    // Every frame: scroll if the pointer is past an edge, then extend the
    // selection to the cell under it. Using coordinates rather than per-cell
    // events keeps working while scrolling and outside the grid.
    const tick = () => {
      const scroller = scrollRef.current;
      const pointer = pointerRef.current;
      if (scroller && pointer) {
        const view = scroller.getBoundingClientRect();
        // A row drag only moves vertically and a column drag horizontally,
        // and they start over the row numbers or headers, inside the edge.
        scroller.scrollBy(
          drag.mode === "row"
            ? 0
            : edgeOverflow(pointer.x, view.left + columnEdges[1], view.left + scroller.clientWidth),
          drag.mode === "column"
            ? 0
            : edgeOverflow(pointer.y, view.top + HEADER_HEIGHT, view.top + scroller.clientHeight)
        );
        const gridX = pointer.x - view.left + scroller.scrollLeft;
        const bodyY = pointer.y - view.top + scroller.scrollTop - HEADER_HEIGHT;
        const cell = {
          row: clamp(Math.floor(bodyY / ROW_HEIGHT), 0, lastRow),
          col: clamp(columnAt(columnEdges, gridX), 0, lastCol),
        };
        const next = selectRange(drag.mode, drag.from, cell, { row: lastRow, col: lastCol });
        setSelection((prev) => (isSameSelection(prev, next) ? prev : next));
      }
      frame = requestAnimationFrame(tick);
    };

    const handleMouseMove = (event: globalThis.MouseEvent) => {
      // A release outside the window sends no mouseup.
      if ((event.buttons & 1) === 0) {
        setDrag(null);
        return;
      }
      pointerRef.current = { x: event.clientX, y: event.clientY };
    };
    const handleMouseUp = () => setDrag(null);

    frame = requestAnimationFrame(tick);
    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [drag, lastRow, lastCol, columnEdges, scrollRef]);

  const selectAll = () => {
    if (rowCount > 0 && colCount > 0) setSelection({ anchor: { row: 0, col: 0 }, focus: last });
  };

  const handleMouseDown = (event: MouseEvent) => {
    const target = (event.target as HTMLElement).closest<HTMLElement>("[data-col]");
    if (!target || rowCount === 0 || (event.button !== 0 && event.button !== 2)) return;
    event.preventDefault();
    scrollRef.current?.focus({ preventScroll: true });

    const row = target.dataset.row === undefined ? -1 : Number(target.dataset.row);
    const col = Number(target.dataset.col);
    if (row === -1 && col === -1) {
      selectAll();
      return;
    }
    const mode: SelectionMode = row === -1 ? "column" : col === -1 ? "row" : "cell";
    const cell = { row: Math.max(row, 0), col: Math.max(col, 0) };

    // A context click (right-click, or Ctrl+click on macOS) keeps a selection
    // it lands in, so the menu acts on it; elsewhere it selects what it hit.
    if (event.button === 2 || event.ctrlKey) {
      if (!isCellSelected(selection, cell)) setSelection(selectRange(mode, cell, cell, last));
      return;
    }
    const from = event.shiftKey && selection ? selection.anchor : cell;
    pointerRef.current = null;
    setSelection(selectRange(mode, from, cell, last));
    setDrag({ mode, from });
  };

  const scrollToCell = ({ row, col }: CellPosition) => {
    const scroller = scrollRef.current;
    if (!scroller) return;
    // Measured past the sticky header and row-number column, which cover cells.
    const stickyWidth = columnEdges[1];
    scroller.scrollTop = revealRange(
      scroller.scrollTop,
      scroller.clientHeight - HEADER_HEIGHT,
      row * ROW_HEIGHT,
      (row + 1) * ROW_HEIGHT
    );
    scroller.scrollLeft = revealRange(
      scroller.scrollLeft,
      scroller.clientWidth - stickyWidth,
      columnEdges[col + 1] - stickyWidth,
      columnEdges[col + 2] - stickyWidth
    );
  };

  const handleKeyDown = (event: KeyboardEvent) => {
    if (rowCount === 0 || colCount === 0) return;
    const isModifier = event.metaKey || event.ctrlKey;
    if (isModifier && event.key.toLowerCase() === "a") {
      event.preventDefault();
      selectAll();
      return;
    }
    if (event.key === "Escape") {
      setSelection(null);
      return;
    }

    const active = selection?.anchor ?? { row: 0, col: 0 };
    const pageRows = Math.max(
      1,
      Math.floor(((scrollRef.current?.clientHeight ?? 0) - HEADER_HEIGHT) / ROW_HEIGHT)
    );
    const target = selection
      ? moveCell(event.shiftKey ? selection.focus : active, event.key, isModifier, pageRows, last)
      : isNavigationKey(event.key) && active;
    if (!target) return;

    event.preventDefault();
    setSelection(
      event.shiftKey && selection ? { anchor: active, focus: target } : { anchor: target, focus: target }
    );
    scrollToCell(target);
  };

  return { selection, isDragging: drag !== null, handleMouseDown, handleKeyDown };
}

// selectRange builds the selection from a press at `from` to `to`. Row and
// column selections always span the full width or height of the grid.
function selectRange(
  mode: SelectionMode,
  from: CellPosition,
  to: CellPosition,
  last: CellPosition
): CellSelection {
  switch (mode) {
    case "column":
      return { anchor: { row: 0, col: from.col }, focus: { row: last.row, col: to.col } };
    case "row":
      return { anchor: { row: from.row, col: 0 }, focus: { row: to.row, col: last.col } };
    case "cell":
      return { anchor: from, focus: to };
  }
}

const NAVIGATION_KEYS = ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "PageUp", "PageDown", "Home", "End"];

function isNavigationKey(key: string) {
  return NAVIGATION_KEYS.includes(key);
}

// moveCell returns where a navigation key moves `from`, or null for any other
// key. With Cmd/Ctrl, arrows jump to the edge and Home/End also change row.
function moveCell(
  from: CellPosition,
  key: string,
  isModifier: boolean,
  pageRows: number,
  last: CellPosition
): CellPosition | null {
  let { row, col } = from;
  switch (key) {
    case "ArrowUp":
      row = isModifier ? 0 : row - 1;
      break;
    case "ArrowDown":
      row = isModifier ? last.row : row + 1;
      break;
    case "ArrowLeft":
      col = isModifier ? 0 : col - 1;
      break;
    case "ArrowRight":
      col = isModifier ? last.col : col + 1;
      break;
    case "PageUp":
      row -= pageRows;
      break;
    case "PageDown":
      row += pageRows;
      break;
    case "Home":
      col = 0;
      if (isModifier) row = 0;
      break;
    case "End":
      col = last.col;
      if (isModifier) row = last.row;
      break;
    default:
      return null;
  }
  return { row: clamp(row, 0, last.row), col: clamp(col, 0, last.col) };
}

// columnAt returns the data column at x px from the grid's left edge.
function columnAt(columnEdges: number[], x: number) {
  let col = 0;
  while (col + 2 < columnEdges.length && columnEdges[col + 2] <= x) col++;
  return col;
}

// revealRange returns the scroll offset that brings [start, end] into a
// viewport of viewSize, moving as little as possible.
function revealRange(scroll: number, viewSize: number, start: number, end: number) {
  if (start < scroll) return start;
  if (end > scroll + viewSize) return end - viewSize;
  return scroll;
}

// edgeOverflow is how far (px) the pointer is past the autoscroll edge of
// [min, max], negative before min; 0 inside.
function edgeOverflow(position: number, min: number, max: number) {
  if (position < min + AUTOSCROLL_EDGE) return position - min - AUTOSCROLL_EDGE;
  if (position > max - AUTOSCROLL_EDGE) return position - max + AUTOSCROLL_EDGE;
  return 0;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function isSameSelection(a: CellSelection | null, b: CellSelection) {
  return (
    a !== null &&
    a.anchor.row === b.anchor.row &&
    a.anchor.col === b.anchor.col &&
    a.focus.row === b.focus.row &&
    a.focus.col === b.focus.col
  );
}
