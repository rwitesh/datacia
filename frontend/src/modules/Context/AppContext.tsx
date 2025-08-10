import React, { createContext, useContext, useMemo, useState } from "react";

type AppContextType = {
  database: string;
  setDatabase: React.Dispatch<React.SetStateAction<string>>;
  tables: string[];
  setTables: React.Dispatch<React.SetStateAction<string[]>>;
};

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider = ({ children }: { children: React.ReactNode }) => {
  const [database, setDatabase] = useState<string>("");
  const [tables, setTables] = useState<string[]>([]);

  const value = useMemo(
    () => ({ database, setDatabase, tables, setTables }),
    [database, tables]
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};

export const useAppContext = () => {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useAppContext must be used within an AppProvider");
  return ctx;
};
