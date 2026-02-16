import { createContext } from "react";
import { SQLDialect } from "@codemirror/lang-sql";
import type { LicenseStatus } from "@/services/bindings/license";
import type { Info } from "@/services/settings";

export type AppContextType = {
  reload: () => void;
  invalidateConnectionQueries: () => void;
  dialect: SQLDialect;
  engine: string;
  licenseStatus: LicenseStatus | undefined;
  isLicenseActive: boolean;
  settings: Info | undefined;
};

export const AppContext = createContext<AppContextType | undefined>(undefined);
