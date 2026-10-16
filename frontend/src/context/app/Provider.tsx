import React, { useCallback, useMemo, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Events } from "@wailsio/runtime";
import { AppContext } from "./Context";
import { chooseDialect } from "@/windows/editor/QueryInput/utils/dialect";
import { useCurrentConnection } from "@/services/connections";
import { useSettings } from "@/services/settings";

export const AppProvider = ({ children }: { children: React.ReactNode }) => {
  const queryClient = useQueryClient();
  const { data: currentConnection } = useCurrentConnection();
  const { data: settings } = useSettings();

  const invalidateConnectionQueries = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["tables"] });
    queryClient.invalidateQueries({ queryKey: ["databases"] });
    queryClient.invalidateQueries({ queryKey: ["queries-tree"] });
    queryClient.invalidateQueries({ queryKey: ["query-history"] });
    queryClient.invalidateQueries({ queryKey: ["connection-health"] });
    queryClient.invalidateQueries({ queryKey: ["current-connection"] });
  }, [queryClient]);

  const reload = () => {
    invalidateConnectionQueries();
    queryClient.invalidateQueries({ queryKey: ["connections"] });
  };

  useEffect(() => {
    const unsubscribe = Events.On("connection-changed", () => {
      invalidateConnectionQueries();
    });
    return () => unsubscribe();
  }, [invalidateConnectionQueries]);

  const dialect = useMemo(
    () => chooseDialect(currentConnection?.engine || null),
    [currentConnection?.engine]
  );

  const value = {
    reload,
    invalidateConnectionQueries,
    dialect,
    engine: currentConnection?.engine || "",
    settings,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};

