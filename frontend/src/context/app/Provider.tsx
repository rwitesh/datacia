import React, { useCallback, useMemo, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Events } from "@wailsio/runtime";
import { AppContext } from "./Context";
import { getDialect } from "@/shared/utils/engines";
import { useCurrentConnection } from "@/services/connections";
import { useSettings } from "@/services/settings";
import { queryKeys } from "@/services/queryKeys";

export const AppProvider = ({ children }: { children: React.ReactNode }) => {
  const queryClient = useQueryClient();
  const { data: currentConnection } = useCurrentConnection();
  const { data: settings } = useSettings();

  const invalidateConnectionQueries = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: queryKeys.tables });
    queryClient.invalidateQueries({ queryKey: queryKeys.ddl });
    queryClient.invalidateQueries({ queryKey: queryKeys.databases });
    queryClient.invalidateQueries({ queryKey: queryKeys.queriesTree });
    queryClient.invalidateQueries({ queryKey: queryKeys.queryHistory });
    queryClient.invalidateQueries({ queryKey: queryKeys.connectionHealth });
    queryClient.invalidateQueries({ queryKey: queryKeys.currentConnection });
  }, [queryClient]);

  const reload = useCallback(() => {
    invalidateConnectionQueries();
    queryClient.invalidateQueries({ queryKey: queryKeys.connections });
  }, [invalidateConnectionQueries, queryClient]);

  useEffect(() => {
    const unsubscribe = Events.On("connection-changed", () => {
      invalidateConnectionQueries();
    });
    return () => unsubscribe();
  }, [invalidateConnectionQueries]);

  const engine = currentConnection?.engine || "";
  const value = useMemo(
    () => ({
      reload,
      dialect: getDialect(engine),
      engine,
      settings,
    }),
    [reload, engine, settings]
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};
