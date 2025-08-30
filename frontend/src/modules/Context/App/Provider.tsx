import React, { useState, useMemo } from "react";
import { AppContext } from "./Context";

export const AppProvider = ({ children }: { children: React.ReactNode }) => {
  const [database, setDatabase] = useState<string>("");

  const value = useMemo(() => ({ database, setDatabase }), [database]);

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};
