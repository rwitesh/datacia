import { useEffect, useMemo, useRef } from "react";
import { EditorView } from "codemirror";
import { EditorState, Compartment } from "@codemirror/state";
import { autocompletion, closeBrackets } from "@codemirror/autocomplete";
import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import { sql } from "@codemirror/lang-sql";
import { drawSelection, keymap } from "@codemirror/view";

import { useEditorContext } from "@/context/editor/Index";
import { useAppContext } from "@/context/app/Index";
import { GetSuggestion } from "@/services/bindings/intellisense";
import { getTheme } from "./utils/theme";
import { ghostText } from "./extensions/ghostText";
import { useTheme } from "@/components/theme";
import { cn } from "@/lib/utils";

interface SQLCodeEditorProps {
  value: string;
  onChange?: (value: string) => void;
  /** A viewer: no editing, ghost text, autocomplete or history. */
  readOnly?: boolean;
  className?: string;
}

export function SQLCodeEditor({ value, onChange, readOnly = false, className }: SQLCodeEditorProps) {
  const editorEl = useRef<HTMLDivElement | null>(null);
  const viewRef = useRef<EditorView | null>(null);

  const { dialect, engine } = useAppContext();
  const { resolvedTheme, tokenColors, editorFontFamily, editorFontSize } =
    useTheme();

  const {
    tables: { data },
  } = useEditorContext();

  const schema = useMemo(
    () => (readOnly ? {} : Object.fromEntries((data || []).map((t) => [t, []]))),
    [data, readOnly],
  );

  // store mutable refs to avoid effect re-runs
  const latestOnChange = useRef(onChange);
  const latestEngine = useRef(engine);

  useEffect(() => {
    latestOnChange.current = onChange;
  }, [onChange]);

  useEffect(() => {
    latestEngine.current = engine;
  }, [engine]);

  // SQL configuration compartment
  const sqlConfig = useMemo(() => new Compartment(), []);
  // Theme configuration compartment
  const themeConfig = useMemo(() => new Compartment(), []);

  // create editor ONCE
  useEffect(() => {
    if (!editorEl.current) return;

    const state = EditorState.create({
      doc: value,
      extensions: [
        drawSelection(),
        EditorView.lineWrapping,
        EditorView.theme({
          "&": { height: "100%" },
          ".cm-scroller": { overflow: "auto" },
        }),

        sqlConfig.of(sql({ dialect, schema, upperCaseKeywords: true })),
        themeConfig.of(
          getTheme(resolvedTheme === "dark", {
            colors: tokenColors,
            fontFamily: editorFontFamily,
            fontSize: editorFontSize,
          }),
        ),

        ...(readOnly
          ? [EditorState.readOnly.of(true), EditorView.editable.of(false)]
          : [
              // Ghost/inline text suggestions from query history
              ghostText({
                delay: 400,
                minInputLength: 2,
                getSuggestion: (input) =>
                  GetSuggestion(input, latestEngine.current ?? ""),
              }),
              autocompletion(),
              closeBrackets(),
              history(),
              keymap.of([...historyKeymap, ...defaultKeymap]),
            ]),

        EditorView.updateListener.of((v) => {
          if (!v.docChanged) return;
          latestOnChange.current?.(v.state.doc.toString());
        }),
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

  // Typing echoes back through onChange with an equal value, so only an
  // external change replaces the document (and resets the cursor).
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    const doc = view.state.doc.toString();
    if (doc !== value) {
      view.dispatch({
        changes: { from: 0, to: doc.length, insert: value },
      });
    }
  }, [value]);

  // dynamically update dialect + schema
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;

    view.dispatch({
      effects: sqlConfig.reconfigure(
        sql({ dialect, schema, upperCaseKeywords: true }),
      ),
    });
  }, [dialect, schema, sqlConfig]);

  // dynamically update theme
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;

    view.dispatch({
      effects: themeConfig.reconfigure(
        getTheme(resolvedTheme === "dark", {
          colors: tokenColors,
          fontFamily: editorFontFamily,
          fontSize: editorFontSize,
        }),
      ),
    });
  }, [
    resolvedTheme,
    themeConfig,
    tokenColors,
    editorFontFamily,
    editorFontSize,
  ]);

  return (
    <div className={cn("relative h-full w-full", className)}>
      <div ref={editorEl} className="h-full w-full" />
    </div>
  );
}
