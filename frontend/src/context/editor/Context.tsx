import { createContext, type RefObject } from "react";
import type { QueryResult } from "@/services/bindings/database";

// Row and column indices are positions in the grid as shown (after any client
// sort). Columns count data columns only; the row-number column is not part
// of a selection.
export interface CellPosition {
  row: number;
  col: number;
}

// CellSelection is a rectangular range. anchor is the cell it started from
// (Shift+click and Shift+arrow extend from it); focus is the end that moves.
export interface CellSelection {
  anchor: CellPosition;
  focus: CellPosition;
}

// The selected columns and, per selected row, an object holding just those.
export type SelectedData = { columns: string[]; rows: Record<string, unknown>[] };

export interface Tab {
  id: string;
  title: string;
  table?: string;
  results: QueryResult | null;
  error?: string;
  isExecuting: boolean;
  type: "query" | "table";
  mode?: "data" | "ddl";
  queryID?: string;
  limit?: number;
  offset?: number;
  pagination: boolean;
  orderBy?: string;
  orderDir?: "asc" | "desc";
  savedPath?: string;
  scroll?: { left: number; top: number };
  // Positions only, saved when the grid unmounts; the selected data is read
  // from the grid (see store.ts). A client sort is lost when the grid
  // remounts, so a selection made under one is not restored.
  selection?: { range: CellSelection; sorted: boolean };
}

export type TableDataParams = {
  table: string;
  limit: number;
  offset: number;
  orderBy?: string;
  orderDir?: "asc" | "desc";
};

export type EditorContextType = {
  tables: {
    data: string[];
    isLoading: boolean;
    error?: Error | null;
  };

  tabs: Tab[];
  activeTab: Tab | undefined;
  createTab: (title?: string, type?: "query" | "table") => Tab;
  closeTab: (tabId: string) => void;
  setActiveTab: (tabId: string) => void;
  updateTab: (tabId: string, updates: Partial<Tab>) => void;

  runQuery: (tabId?: string) => Promise<void>;
  stopQuery: (tabId?: string) => Promise<void>;
  // Loads a page of a table tab's data, honouring its sort order.
  loadTableData: (tabId: string, params: TableDataParams) => Promise<void>;

  // Result table ref for PNG export
  tableRef: RefObject<HTMLDivElement | null>;
};

export const EditorContext = createContext<EditorContextType | undefined>(
  undefined
);
