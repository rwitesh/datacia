import { useEffect, useMemo, useRef } from "react";
import { EditorView } from "codemirror";
import { EditorState, Compartment } from "@codemirror/state";
import { autocompletion, closeBrackets } from "@codemirror/autocomplete";
import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import { sql } from "@codemirror/lang-sql";
import { drawSelection, keymap } from "@codemirror/view";

import { useEditorContext } from "@/modules/Context/Editor/Index";
import { useAppContext } from "@/modules/Context/App/Index";
import { defaultTheme } from "./utils/theme";

export function QueryInput() {
  const editorEl = useRef<HTMLDivElement | null>(null);
  const viewRef = useRef<EditorView | null>(null);

  const { dialect } = useAppContext();
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

    const state = EditorState.create({
      doc: activeTab?.sql || "",
      extensions: [
        drawSelection(),
        EditorView.lineWrapping,

        sqlConfig.of(sql({ dialect, schema })),

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // dynamically update dialect + schema
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;

    view.dispatch({
      effects: sqlConfig.reconfigure(sql({ dialect, schema })),
    });
  }, [dialect, schema, sqlConfig]);

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
