import type { DatabaseEngine } from "@/modules/Connection/utils/types";
import { createContext } from "react";

export type Metadata = {
  engine: DatabaseEngine;
  database: string;
  host: string;
  port: string;
  username: string;
  password: string;
};

export type AppContextType = {
  metadata: Metadata | null;
  setMetadata: React.Dispatch<React.SetStateAction<Metadata | null>>;
  reload: () => void;
};

export const AppContext = createContext<AppContextType | undefined>(undefined);
