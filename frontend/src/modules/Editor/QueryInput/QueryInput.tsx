import { useEffect, useMemo, useRef } from "react";
import { EditorView } from "codemirror";
import { EditorState } from "@codemirror/state";
import { autocompletion, closeBrackets } from "@codemirror/autocomplete";
import { defaultKeymap, history, historyKeymap} from "@codemirror/commands";
import { sql } from "@codemirror/lang-sql";
import { keymap, lineNumbers } from "@codemirror/view";
import { useEditorContext } from "@/modules/Context/Editor/Index";
import { ClickhouseDialect } from "./sql";
import { useAppContext } from "@/modules/Context/App/Index";

export function QueryInput() {
  const editorRef = useRef<HTMLDivElement | null>(null);
  const viewRef = useRef<EditorView | null>(null);

  const { engine } = useAppContext();
  console.log(engine);

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

    const state = EditorState.create({
      extensions: [
        lineNumbers(),
        EditorView.lineWrapping,
        sql({ dialect: ClickhouseDialect, schema }),
        autocompletion(),
        closeBrackets(),
        history(),
        keymap.of([...historyKeymap, ...defaultKeymap]),
        EditorView.updateListener.of((v) => {
          if (v.docChanged && tabId) {
            updateTab(tabId, { sql: v.state.doc.toString() });
          }
        
        }),
        EditorView.theme({
          "&": {
            height: "100%",
            fontFamily: "monospace",
            fontSize: "0.875rem",
          },
          ".cm-scroller": {
            height: "100%",
            overflow: "auto",
          },
          ".cm-tooltip": {
            color: "var(--foreground)",
            backgroundColor: "var(--background)",
          },
          ".cm-lineNumbers": {
            backgroundColor: "var(--card)",
          },
          ".cm-content": {
            caretColor: "var(--foreground)",
          },
          ".cm-gutters": {
            border: "none",
          },
        }),
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
