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
import { formatSQL } from "./utils/formatter";
import { ghostText } from "./extensions/ghostText";
import { Button } from "@/components/ui/button";
import { Play, StopCircle, Paintbrush } from "lucide-react";
import { useTheme } from "@/components/theme";

export function QueryInput() {
  const editorEl = useRef<HTMLDivElement | null>(null);
  const viewRef = useRef<EditorView | null>(null);

  const { dialect, engine, isLicenseActive } = useAppContext();
  const { resolvedTheme, tokenColors, editorFontFamily, editorFontSize } =
    useTheme();

  const {
    tables: { data },
    activeTab,
    updateTab,
    runQuery,
    stopQuery,
  } = useEditorContext();

  const tabId = activeTab?.id ?? null;

  const schema = useMemo(() => {
    return Object.fromEntries((data || []).map((t) => [t, []]));
  }, [data]);

  // store mutable refs to avoid effect re-runs
  const latestTabId = useRef(tabId);
  const latestUpdateTab = useRef(updateTab);
  const latestEngine = useRef(engine);

  useEffect(() => {
    latestTabId.current = tabId;
  }, [tabId]);

  useEffect(() => {
    latestUpdateTab.current = updateTab;
  }, [updateTab]);

  useEffect(() => {
    latestEngine.current = engine;
  }, [engine]);

  // SQL configuration compartment
  const sqlConfig = useMemo(() => new Compartment(), []);
  // Theme configuration compartment
  const themeConfig = useMemo(() => new Compartment(), []);
  // Ghost/inline text — only when pro (license) is active
  const ghostTextConfig = useMemo(() => new Compartment(), []);

  // create editor ONCE
  useEffect(() => {
    if (!editorEl.current) return;

    const state = EditorState.create({
      doc: activeTab?.sql || "",
      extensions: [
        drawSelection(),
        EditorView.lineWrapping,

        sqlConfig.of(sql({ dialect, schema, upperCaseKeywords: true })),
        themeConfig.of(
          getTheme(resolvedTheme === "dark", {
            colors: tokenColors,
            fontFamily: editorFontFamily,
            fontSize: editorFontSize,
          }),
        ),

        ghostTextConfig.of([]),

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

  // Ghost/inline text only when pro (license) is active — create fresh extension
  // when enabling so CodeMirror compartment applies it (reused ref can be skipped)
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;

    view.dispatch({
      effects: ghostTextConfig.reconfigure(
        isLicenseActive
          ? ghostText({
              delay: 400,
              minInputLength: 2,
              getSuggestion: (input) =>
                GetSuggestion(input, latestEngine.current ?? ""),
            })
          : [],
      ),
    });
  }, [isLicenseActive, ghostTextConfig]);

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

  const handleFormat = () => {
    if (activeTab && activeTab.type === "query") {
      const formatted = formatSQL(activeTab.sql || "", engine || "sql");
      updateTab(activeTab.id, { sql: formatted });
    }
  };

  return (
    <div className="relative h-full w-full">
      <div ref={editorEl} className="h-full w-full" />

      {/* Floating Action Buttons */}
      <div className="absolute bottom-3 right-3 flex items-center gap-2 z-10">
        <Button
          variant="outline"
          size="sm"
          className="h-7 px-3 cursor-pointer select-none gap-1.5 bg-background/80 backdrop-blur-sm hover:bg-background shadow-md border-border/50"
          onClick={handleFormat}
        >
          <Paintbrush className="w-3.5 h-3.5" />
          Format
        </Button>

        {!activeTab?.isExecuting ? (
          <Button
            size="sm"
            className="h-7 px-4 cursor-pointer select-none gap-1.5 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white shadow-lg shadow-emerald-500/25 border-0 font-medium"
            onClick={() => runQuery()}
          >
            <Play className="w-3.5 h-3.5" strokeWidth={2.5} />
            Run
          </Button>
        ) : (
          <Button
            size="sm"
            className="h-7 px-4 cursor-pointer select-none gap-1.5 bg-gradient-to-r from-red-500 to-rose-500 hover:from-red-600 hover:to-rose-600 text-white shadow-lg shadow-red-500/25 border-0 font-medium"
            onClick={() => stopQuery()}
          >
            <StopCircle className="w-3.5 h-3.5" strokeWidth={2.5} />
            Stop
          </Button>
        )}
      </div>
    </div>
  );
}
