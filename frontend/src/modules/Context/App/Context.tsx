import { createContext } from "react";

export type Metadata = {
  database: string;
  host: string;
  port: number;
  username: string;
};

export type AppContextType = {
  metadata: Metadata | null;
  setMetadata: React.Dispatch<React.SetStateAction<Metadata | null>>;
};

export const AppContext = createContext<AppContextType | undefined>(undefined);
