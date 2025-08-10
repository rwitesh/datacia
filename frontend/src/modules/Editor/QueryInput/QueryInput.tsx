import { useEffect, useMemo, useRef } from "react";
import { EditorView } from "codemirror";
import { EditorState } from "@codemirror/state";
import { autocompletion, closeBrackets } from "@codemirror/autocomplete";
import { sql } from "@codemirror/lang-sql";
import { lineNumbers } from "@codemirror/view";
import { useEditorContext } from "@/modules/Context/EditorContext";

export function QueryInput({
  sqlQuery,
  setSqlQuery,
}: {
  sqlQuery: string;
  setSqlQuery: (value: string) => void;
}) {
  const editorRef = useRef<HTMLDivElement | null>(null);
  const viewRef = useRef<EditorView | null>(null);

  const { tables } = useEditorContext();

  const schema = useMemo(() => {
    return Object.fromEntries((tables || []).map((t) => [t, []]));
  }, [tables]);

  useEffect(() => {
    if (!editorRef.current) return;

    if (viewRef.current) {
      viewRef.current.destroy();
      viewRef.current = null;
    }

    const state = EditorState.create({
      doc: sqlQuery,
      extensions: [
        lineNumbers(),
        sql({ upperCaseKeywords: true, schema }),
        autocompletion(),
        closeBrackets(),
        EditorView.updateListener.of((v) => {
          if (v.docChanged) {
            setSqlQuery(v.state.doc.toString());
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
  }, [schema, setSqlQuery]);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;

    const currentDoc = view.state.doc.toString();
    if (currentDoc !== sqlQuery) {
      view.dispatch({
        changes: { from: 0, to: currentDoc.length, insert: sqlQuery },
      });
    }
  }, [sqlQuery]);

  return (
    <div className="h-full w-full">
      <div
        ref={editorRef}
        className="h-full w-full font-mono text-sm"
      />
    </div>
  );
}
