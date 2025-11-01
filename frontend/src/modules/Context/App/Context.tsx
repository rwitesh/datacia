import { createContext } from "react";

export type AppContextType = Record<string, never>;

export const AppContext = createContext<AppContextType | undefined>(undefined);
