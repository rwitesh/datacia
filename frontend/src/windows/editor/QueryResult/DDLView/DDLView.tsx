import { useEffect, useMemo, useRef } from "react";
import { EditorView } from "@codemirror/view";
import { EditorState, Compartment } from "@codemirror/state";
import { sql } from "@codemirror/lang-sql";

import { formatSQL } from "@/windows/editor/QueryInput/utils/formatter";
import { getTheme } from "@/windows/editor/QueryInput/utils/theme";
import { useAppContext } from "@/context/app/Index";
import { useTheme } from "@/components/theme";

interface DDLViewProps {
    ddl: string;
    isLoading: boolean;
    error?: string;
}

export function DDLView({ ddl, isLoading, error }: DDLViewProps) {
    const containerRef = useRef<HTMLDivElement | null>(null);
    const viewRef = useRef<EditorView | null>(null);
    const { dialect, engine } = useAppContext();
    const { resolvedTheme, tokenColors, editorFontFamily, editorFontSize } = useTheme();

    const formattedDDL = useMemo(
        () => (ddl ? formatSQL(ddl, engine || "") : ""),
        [ddl, engine]
    );

    const sqlConfig = useMemo(() => new Compartment(), []);
    const themeConfig = useMemo(() => new Compartment(), []);

    useEffect(() => {
        if (!containerRef.current || !formattedDDL) return;

        const state = EditorState.create({
            doc: formattedDDL,
            extensions: [
                EditorView.lineWrapping,
                EditorView.editable.of(false),
                EditorView.contentAttributes.of({ "data-readonly": "true" }),
                sqlConfig.of(sql({ dialect, schema: {}, upperCaseKeywords: true })),
                themeConfig.of(
                    getTheme(resolvedTheme === "dark", {
                        colors: tokenColors,
                        fontFamily: editorFontFamily,
                        fontSize: editorFontSize,
                    })
                ),
            ],
        });

        const view = new EditorView({
            state,
            parent: containerRef.current,
        });
        viewRef.current = view;

        return () => {
            view.destroy();
            viewRef.current = null;
        };
        // Create once when we have content; dialect/theme updates handled by reconfigure effects below
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [!!formattedDDL]);

    useEffect(() => {
        const view = viewRef.current;
        if (!view || !formattedDDL) return;
        const current = view.state.doc.toString();
        if (current !== formattedDDL) {
            view.dispatch({
                changes: { from: 0, to: current.length, insert: formattedDDL },
            });
        }
    }, [formattedDDL]);

    useEffect(() => {
        const view = viewRef.current;
        if (!view) return;
        view.dispatch({
            effects: sqlConfig.reconfigure(sql({ dialect, schema: {}, upperCaseKeywords: true })),
        });
    }, [dialect, sqlConfig]);

    useEffect(() => {
        const view = viewRef.current;
        if (!view) return;
        view.dispatch({
            effects: themeConfig.reconfigure(
                getTheme(resolvedTheme === "dark", {
                    colors: tokenColors,
                    fontFamily: editorFontFamily,
                    fontSize: editorFontSize,
                })
            ),
        });
    }, [resolvedTheme, themeConfig, tokenColors, editorFontFamily, editorFontSize]);

    if (isLoading) {
        return (
            <div className="flex justify-center items-center h-full">
                <div className="animate-spin h-8 w-8 border-b-2 border-primary rounded-full"></div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex justify-center items-center h-full text-red-500">
                {error}
            </div>
        );
    }

    if (!ddl) {
        return (
            <div className="flex justify-center items-center h-full text-muted-foreground">
                No DDL available
            </div>
        );
    }

    return (
        <div className="h-full overflow-auto p-4">
            <div
                ref={containerRef}
                className="font-mono text-sm bg-muted/50 p-4 rounded-md border min-h-full text-left [&_.cm-editor]:outline-none [&_.cm-scroller]:overflow-auto [&_.cm-content]:min-h-full"
            />
        </div>
    );
}
