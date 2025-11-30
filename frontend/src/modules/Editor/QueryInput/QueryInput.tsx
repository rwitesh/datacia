import { useEffect, useMemo, useRef } from "react";
import { EditorView } from "codemirror";
import { EditorState } from "@codemirror/state";
import { autocompletion, closeBrackets } from "@codemirror/autocomplete";
import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import { PostgreSQL, sql, SQLDialect, StandardSQL } from "@codemirror/lang-sql";
import { drawSelection, keymap, lineNumbers } from "@codemirror/view";
import { useEditorContext } from "@/modules/Context/Editor/Index";
import { ClickhouseDialect } from "./sql";
import { useAppContext } from "@/modules/Context/App/Index";
import { defaultTheme } from "./theme";

export function QueryInput() {
  const editorRef = useRef<HTMLDivElement | null>(null);
  const viewRef = useRef<EditorView | null>(null);

  const { engine } = useAppContext();

  const {
    tables: { data },
    activeTab,
    updateTab,
  } = useEditorContext();

  const tabId = useMemo(() => activeTab?.id, [activeTab?.id]);

  const schema = useMemo(() => {
    return Object.fromEntries((data || []).map((t) => [t, []]));
  }, [data]);

  useEffect(() => {
    if (!editorRef.current || !schema || !tabId) return;

    if (viewRef.current) {
      viewRef.current.destroy();
      viewRef.current = null;
    }

    let dialect: SQLDialect;
    if (engine === "clickhouse") {
      dialect = ClickhouseDialect;
    } else if (engine === "postgres") {
      dialect = PostgreSQL;
    } else if (engine === "sqlite") {
      dialect = StandardSQL; // SQLite uses standard SQL mostly
    } else {
      dialect = StandardSQL;
    }

    const state = EditorState.create({
      extensions: [
        lineNumbers(),
        drawSelection(),
        EditorView.lineWrapping,
        sql({ dialect, schema }),
        autocompletion(),
        closeBrackets(),
        history(),
        keymap.of([...historyKeymap, ...defaultKeymap]),
        EditorView.updateListener.of((v) => {
          if (v.docChanged && tabId) {
            updateTab(tabId, { sql: v.state.doc.toString() });
          }
        }),
        defaultTheme,
      ],
    });

    const view = new EditorView({
      state,
      parent: editorRef.current,
    });

    viewRef.current = view;

    return () => {
      view.destroy();
      viewRef.current = null;
    };
  }, [schema, tabId, updateTab]);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;

    const currentDoc = view.state.doc.toString();
    if (currentDoc !== activeTab?.sql) {
      view.dispatch({
        changes: { from: 0, to: currentDoc.length, insert: activeTab?.sql },
      });
    }
  }, [activeTab]);

  return (
    <div className="h-full w-full">
      <div
        ref={editorRef}
        className="h-full w-full font-mono text-sm bg-card"
      />
    </div>
  );
}
