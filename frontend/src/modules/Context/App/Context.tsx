import { createContext } from "react";
import { SQLDialect } from "@codemirror/lang-sql";
import type { LicenseStatus } from "@/services/license";

export type AppContextType = {
  reload: () => void;
  invalidateConnectionQueries: () => void;
  dialect: SQLDialect;
  licenseStatus: LicenseStatus | undefined;
  isLicenseActive: boolean;
};

export const AppContext = createContext<AppContextType | undefined>(undefined);
