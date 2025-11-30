import { useEffect, useMemo, useRef } from "react";
import { EditorView } from "codemirror";
import { EditorState, Compartment } from "@codemirror/state";
import { autocompletion, closeBrackets } from "@codemirror/autocomplete";
import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import { sql, PostgreSQL, StandardSQL, SQLDialect } from "@codemirror/lang-sql";
import { drawSelection, keymap, lineNumbers } from "@codemirror/view";

import { useEditorContext } from "@/modules/Context/Editor/Index";
import { useAppContext } from "@/modules/Context/App/Index";
import { ClickhouseDialect } from "./sql";
import { defaultTheme } from "./theme";

export function QueryInput() {
  const editorEl = useRef<HTMLDivElement | null>(null);
  const viewRef = useRef<EditorView | null>(null);

  const { engine } = useAppContext();
  const {
    tables: { data },
    activeTab,
    updateTab,
  } = useEditorContext();

  const tabId = activeTab?.id ?? null;

  const schema = useMemo(() => {
    return Object.fromEntries((data || []).map((t) => [t, []]));
  }, [data]);

  // store mutable refs to avoid effect re-runs
  const latestTabId = useRef(tabId);
  const latestUpdateTab = useRef(updateTab);

  useEffect(() => {
    latestTabId.current = tabId;
  }, [tabId]);

  useEffect(() => {
    latestUpdateTab.current = updateTab;
  }, [updateTab]);

  // SQL configuration compartment
  const sqlConfig = useMemo(() => new Compartment(), []);

  // create editor ONCE
  useEffect(() => {
    if (!editorEl.current) return;

    const initialDialect: SQLDialect =
      engine === "clickhouse"
        ? ClickhouseDialect
        : engine === "postgres"
          ? PostgreSQL
          : StandardSQL;

    const state = EditorState.create({
      doc: activeTab?.sql || "",
      extensions: [
        lineNumbers(),
        drawSelection(),
        EditorView.lineWrapping,

        sqlConfig.of(sql({ dialect: initialDialect, schema })),

        autocompletion(),
        closeBrackets(),
        history(),
        keymap.of([...historyKeymap, ...defaultKeymap]),

        EditorView.updateListener.of((v) => {
          if (!v.docChanged) return;
          const id = latestTabId.current;
          if (id) {
            latestUpdateTab.current(id, {
              sql: v.state.doc.toString(),
            });
          }
        }),

        defaultTheme,
      ],
    });

    const view = new EditorView({
      state,
      parent: editorEl.current,
    });

    viewRef.current = view;

    return () => view.destroy();
    // run ONCE
  }, []);

  // dynamically update dialect + schema
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;

    const dialect: SQLDialect =
      engine === "clickhouse"
        ? ClickhouseDialect
        : engine === "postgres"
          ? PostgreSQL
          : StandardSQL;

    view.dispatch({
      effects: sqlConfig.reconfigure(sql({ dialect, schema })),
    });
  }, [engine, schema, sqlConfig]);

  // sync tab content on tab switch
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    const doc = view.state.doc.toString();
    const expected = activeTab?.sql ?? "";

    if (doc !== expected) {
      view.dispatch({
        changes: { from: 0, to: doc.length, insert: expected },
      });
    }
  }, [activeTab?.id, activeTab?.sql]);

  return <div ref={editorEl} className="h-full w-full font-mono text-sm bg-card" />;
}
