import React from "react";
import { useQueryClient } from "@tanstack/react-query";
import { AppContext } from "./Context";

export const AppProvider = ({ children }: { children: React.ReactNode }) => {
  const queryClient = useQueryClient();

  const reload = () => {
    // Invalidate cache for tables, databases, and connections
    queryClient.invalidateQueries({ queryKey: ["tables"] });
    queryClient.invalidateQueries({ queryKey: ["databases"] });
    queryClient.invalidateQueries({ queryKey: ["connections"] });
  };

  const value = {
    reload,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};
