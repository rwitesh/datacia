import { createContext } from "react";

export type AppContextType = {
  reload: () => void;
};

export const AppContext = createContext<AppContextType | undefined>(undefined);
