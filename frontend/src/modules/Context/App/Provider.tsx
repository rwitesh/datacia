import React, { useCallback, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { AppContext } from "./Context";
import { chooseDialect } from "@/modules/Editor/QueryInput/utils/dialect";
import { useCurrentConnection } from "@/services/hooks";
import type { DatabaseEngine } from "@/modules/Connection/utils/types";

export const AppProvider = ({ children }: { children: React.ReactNode }) => {
  const queryClient = useQueryClient();
  const { data: currentConnection } = useCurrentConnection();

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

  const dialect = useMemo(
    () => chooseDialect(currentConnection?.engine as DatabaseEngine | null),
    [currentConnection?.engine]
  );

  const value = {
    reload,
    invalidateConnectionQueries,
    dialect,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};
