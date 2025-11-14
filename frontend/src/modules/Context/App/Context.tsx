import { createContext } from "react";
import type { DatabaseEngine } from "@/modules/Connection/utils/types";

export type AppContextType = {
  reload: () => void;
  engine: DatabaseEngine | null;
  setEngine: (engine: DatabaseEngine | null) => void;
};

export const AppContext = createContext<AppContextType | undefined>(undefined);
