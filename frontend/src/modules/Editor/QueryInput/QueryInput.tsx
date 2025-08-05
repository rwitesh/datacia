import { useEffect, useMemo, useRef } from "react";
import { EditorView } from "codemirror";
import { EditorState } from "@codemirror/state";
import { autocompletion } from "@codemirror/autocomplete";
import { sql } from "@codemirror/lang-sql";
import { useAppContext } from "@/modules/Context/AppContext";
export function QueryInput({
  sqlQuery,
  setSqlQuery,
}: {
  sqlQuery: string;
  setSqlQuery: (value: string) => void;
}) {
  const editorRef = useRef<HTMLDivElement | null>(null);
  const viewRef = useRef<EditorView | null>(null);

  const { tables } = useAppContext();

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
        sql({ upperCaseKeywords: true, schema }),
        autocompletion(),
        EditorView.updateListener.of((v) => {
          if (v.docChanged) {
            const newVal = v.state.doc.toString();
            setSqlQuery(newVal);
          }
        }),
        EditorView.theme({
          "&": {
            height: "200px",
            fontFamily: "monospace",
            fontSize: "0.875rem",
          },
          ".cm-tooltip": {
            color: "var(--foreground)",
            backgroundColor: "var(--background)",
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
  }, [schema]);


  return (
    <div className="flex-none">
      <div className="text-sm font-medium mb-2">SQL Query</div>
      <div ref={editorRef} className="border rounded font-mono text-sm" />
    </div>
  );
}
