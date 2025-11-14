import { createContext } from "react";
import type { DatabaseEngine } from "@/modules/Connection/utils/types";

export type AppContextType = {
  reload: () => void;
  engine: DatabaseEngine | string | null;
  setEngine: (engine: DatabaseEngine | string | null) => void;
};

export const AppContext = createContext<AppContextType | undefined>(undefined);
