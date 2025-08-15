import { useEffect, useMemo, useRef } from "react";
import { EditorView } from "codemirror";
import { EditorState } from "@codemirror/state";
import { autocompletion, closeBrackets } from "@codemirror/autocomplete";
import { sql } from "@codemirror/lang-sql";
import { lineNumbers } from "@codemirror/view";
import { useEditorContext } from "@/modules/Context/EditorContext";

export function QueryInput() {
  const editorRef = useRef<HTMLDivElement | null>(null);
  const viewRef = useRef<EditorView | null>(null);

  const {
    tables: { data },
    activeTab,
    updateTab,
  } = useEditorContext();

  const schema = useMemo(() => {
    return Object.fromEntries((data || []).map((t) => [t, []]));
  }, [data]);

  useEffect(() => {
    if (!editorRef.current) return;

    if (viewRef.current) {
      viewRef.current.destroy();
      viewRef.current = null;
    }

    const state = EditorState.create({
      doc: activeTab?.sql,
      extensions: [
        lineNumbers(),
        sql({ upperCaseKeywords: true, schema }),
        autocompletion(),
        closeBrackets(),
        EditorView.updateListener.of((v) => {
          if (v.docChanged && activeTab?.id) {
            updateTab(activeTab.id, { sql: v.state.doc.toString() });
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
            backgroundColor: "var(--background)",
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
  }, [schema, activeTab?.id, updateTab]);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;

    const currentDoc = view.state.doc.toString();
    if (currentDoc !== activeTab?.sql) {
      view.dispatch({
        changes: { from: 0, to: currentDoc.length, insert: activeTab?.sql },
      });
    }
  }, [activeTab?.sql]);

  return (
    <div className="h-full w-full">
      <div ref={editorRef} className="h-full w-full font-mono text-sm" />
    </div>
  );
}
