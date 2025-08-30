import { createContext } from "react";

export type AppContextType = {
  database: string;
  setDatabase: React.Dispatch<React.SetStateAction<string>>;
};

export const AppContext = createContext<AppContextType | undefined>(undefined);
