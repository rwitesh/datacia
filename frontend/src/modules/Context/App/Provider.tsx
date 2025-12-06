import React, { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { AppContext } from "./Context";
import type { DatabaseEngine } from "@/modules/Connection/utils/types";
import { chooseDialect } from "@/modules/Editor/QueryInput/utils/dialect";

export const AppProvider = ({ children }: { children: React.ReactNode }) => {
  const queryClient = useQueryClient();
  const [engine, setEngine] = useState<DatabaseEngine | null>(null);

  const reload = () => {
    // Invalidate cache for tables, databases, and connections
    queryClient.invalidateQueries({ queryKey: ["tables"] });
    queryClient.invalidateQueries({ queryKey: ["databases"] });
    queryClient.invalidateQueries({ queryKey: ["connections"] });
    queryClient.invalidateQueries({ queryKey: ["query-history"] });
  };

  const dialect = useMemo(() => chooseDialect(engine), [engine]);

  const value = {
    reload,
    engine,
    setEngine,
    dialect,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};
