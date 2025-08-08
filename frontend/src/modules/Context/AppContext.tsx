import React, { createContext, useContext, useMemo, useCallback, useState } from "react";
import { Close } from "../../../wailsjs/go/database/ClickHouse";

type AppContextType = {
  database: string;
  setDatabase: React.Dispatch<React.SetStateAction<string>>;
  tables: string[];
  setTables: React.Dispatch<React.SetStateAction<string[]>>;
  closeConnection: () => Promise<void>;
};

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider = ({ children }: { children: React.ReactNode }) => {
  const [database, setDatabase] = useState<string>("");
  const [tables, setTables] = useState<string[]>([]);

  const closeConnection = useCallback(async () => {
    try {
      await Close();
      setDatabase("")
    } catch (err) {

    }
  }, []);

  const value = useMemo(
    () => ({ database, setDatabase, tables, setTables, closeConnection }),
    [database, tables]
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};

export const useAppContext = () => {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useAppContext must be used within an AppProvider");
  return ctx;
};
