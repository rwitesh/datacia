import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { ListTables } from "@/services/clickhouse";
import { useAppContext } from "./AppContext";

type EditorContextType = {
    tables: string[];
    loading: boolean;
    error?: string;
    refresh: () => void;
};

const EditorContext = createContext<EditorContextType | undefined>(undefined);

function shallowArrayEqual(a: string[], b: string[]) {
    if (a === b) return true;
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
    return true;
}

export const EditorProvider = ({ children }: { children: React.ReactNode }) => {
    const { database } = useAppContext();
    const [tables, setTables] = useState<string[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string>();
    const inFlightForDb = useRef<string | undefined>(undefined);

    const fetchTables = async (db?: string) => {
        const activeDb = db ?? database;
        if (!activeDb) {
            inFlightForDb.current = undefined;
            setTables([]);
            setError(undefined);
            setLoading(false);
            return;
        }

        inFlightForDb.current = activeDb;
        setLoading(true);
        setError(undefined);

        try {
            const next = (await ListTables(activeDb)) || [];
            if (inFlightForDb.current === activeDb) {
                setTables(prev => (shallowArrayEqual(prev, next) ? prev : next));
            }
        } catch (e: any) {
            if (inFlightForDb.current === activeDb) {
                setTables([]);
                setError(e?.message ?? String(e));
            }
        } finally {
            if (inFlightForDb.current === activeDb) setLoading(false);
        }
    };

    // Refetch when database changes
    useEffect(() => {
        fetchTables();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [database]);

    const value = useMemo(
        () => ({
            tables,
            loading,
            error,
            refresh: () => fetchTables(),
        }),
        [tables, loading, error]
    );

    return <EditorContext.Provider value={value}>{children}</EditorContext.Provider>;
};

export const useEditorContext = () => {
    const ctx = useContext(EditorContext);
    if (!ctx) throw new Error("useEditorContext must be used within an EditorProvider");
    return ctx;
};
