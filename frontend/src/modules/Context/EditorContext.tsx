// modules/Context/EditorContext.tsx
import React, { createContext, useContext, useMemo } from "react";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { ListTables } from "@/services/clickhouse";
import { useAppContext } from "./AppContext";

type EditorContextType = {
    tables: string[];
    loading: boolean;
    error?: string;
    refresh: () => void;
};

const EditorContext = createContext<EditorContextType | undefined>(undefined);

export const EditorProvider = ({ children }: { children: React.ReactNode }) => {
    const { database } = useAppContext();

    const q = useQuery<string[], Error>({
        queryKey: ["tables", database ?? ""],
        queryFn: async () => {
            if (!database) return [];
            const rows = await ListTables(database);
            return rows ?? [];
        },
        enabled: !!database,

        refetchOnWindowFocus: false,
        staleTime: 10_000,
        retry: 2,
        placeholderData: keepPreviousData,
    });

    const value = useMemo<EditorContextType>(
        () => ({
            tables: q.data ?? [],
            loading: q.isFetching,
            error: q.error ? String(q.error) : undefined,
            refresh: () => { void q.refetch(); },
        }),
        [q.data, q.isFetching, q.error, q.refetch]
    );

    return <EditorContext.Provider value={value}>{children}</EditorContext.Provider>;
};

export const useEditorContext = () => {
    const ctx = useContext(EditorContext);
    if (!ctx) throw new Error("useEditorContext must be used within an EditorProvider");
    return ctx;
};
