import { createContext } from "react";

export type Metadata = {
  database: string;
  host: string;
  port: string;
  username: string;
  password: string;
};

export type AppContextType = {
  metadata: Metadata;
  setMetadata: React.Dispatch<React.SetStateAction<Metadata>>;
  reload: () => void;
};

export const AppContext = createContext<AppContextType | undefined>(undefined);
