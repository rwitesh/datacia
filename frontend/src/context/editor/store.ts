import { useMemo, useSyncExternalStore } from "react";
import type { SelectedData } from "./Context";

// Kept outside the editor context so a keystroke or a cell selection re-renders
// only the components that read it, not every consumer of the context.
const sqlByTab = new Map<string, string>();
let selectionReader: (() => SelectedData) | null = null;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getTabSql(tabId: string) {
  return sqlByTab.get(tabId) ?? "";
}

export function setTabSql(tabId: string, sql: string) {
  if (getTabSql(tabId) === sql) return;
  sqlByTab.set(tabId, sql);
  emit();
}

export function clearTabSql(tabId: string) {
  if (sqlByTab.delete(tabId)) emit();
}

export function useTabSql(tabId: string | undefined) {
  return useSyncExternalStore(subscribe, () => (tabId ? getTabSql(tabId) : ""));
}

/** The mounted grid registers how to read its selection; null when it unmounts. */
export function setSelectionReader(read: (() => SelectedData) | null) {
  if (selectionReader === read) return;
  selectionReader = read;
  emit();
}

/** The selected rows, built only when a selection changes and something shows them. */
export function useSelectedRows() {
  const read = useSyncExternalStore(subscribe, () => selectionReader);
  return useMemo(() => read?.().rows ?? [], [read]);
}
