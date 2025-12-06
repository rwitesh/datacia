import { createContext } from "react";
import type { DatabaseEngine } from "@/modules/Connection/utils/types";
import { SQLDialect } from "@codemirror/lang-sql";

export type AppContextType = {
  reload: () => void;
  engine: DatabaseEngine | null;
  setEngine: (engine: DatabaseEngine | null) => void;
  dialect: SQLDialect;
};

export const AppContext = createContext<AppContextType | undefined>(undefined);
