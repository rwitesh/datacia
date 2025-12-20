import { createContext } from "react";
import { SQLDialect } from "@codemirror/lang-sql";

export type AppContextType = {
  reload: () => void;
  invalidateConnectionQueries: () => void;
  dialect: SQLDialect;
};

export const AppContext = createContext<AppContextType | undefined>(undefined);
