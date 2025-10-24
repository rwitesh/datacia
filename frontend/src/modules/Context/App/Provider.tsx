import React, { useState, useEffect, useMemo, useCallback } from "react";
import { AppContext, type Metadata } from "./Context";
import { Events } from "@wailsio/runtime";
import { useQueryClient } from "@tanstack/react-query";

export const AppProvider = ({ children }: { children: React.ReactNode }) => {
  const queryClient = useQueryClient();
  const [metadata, setMetadata] = useState<Metadata | null>(null);
  const reload = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["databases"] });
    if (metadata?.database) {
      queryClient.invalidateQueries({
        queryKey: ["tables"],
      });
    }
  }, [queryClient, metadata?.database]);

  useEffect(() => {
    const unsub = Events.On("database:connected", (ev) => {
      const meta = ev.data[0];
      setMetadata(meta);
      reload();
    });

    return () => {
      unsub();
    };
  }, [reload]);

  const value = useMemo(
    () => ({ metadata, setMetadata, reload }),
    [metadata, setMetadata, reload]
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};
