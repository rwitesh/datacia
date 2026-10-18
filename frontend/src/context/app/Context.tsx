import { createContext } from "react";
import { SQLDialect } from "@codemirror/lang-sql";
import type { Info } from "@/services/settings";

export type AppContextType = {
  reload: () => void;
  dialect: SQLDialect;
  engine: string;
  settings: Info | undefined;
};

export const AppContext = createContext<AppContextType | undefined>(undefined);
