import React, { useCallback, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { AppContext } from "./Context";
import { chooseDialect } from "@/modules/Editor/QueryInput/utils/dialect";
import { useCurrentConnection } from "@/services/connections";
import { useLicenseStatus } from "@/services/license";
import { useAppInfo } from "@/services/appInfo";

export const AppProvider = ({ children }: { children: React.ReactNode }) => {
  const queryClient = useQueryClient();
  const { data: currentConnection } = useCurrentConnection();
  const { data: licenseStatus } = useLicenseStatus();
  const { data: appInfo } = useAppInfo();

  console.log(appInfo)

  const invalidateConnectionQueries = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["tables"] });
    queryClient.invalidateQueries({ queryKey: ["databases"] });
    queryClient.invalidateQueries({ queryKey: ["queries-tree"] });
    queryClient.invalidateQueries({ queryKey: ["query-history"] });
    queryClient.invalidateQueries({ queryKey: ["connection-health"] });
    queryClient.invalidateQueries({ queryKey: ["current-connection"] });
  }, [queryClient]);

  const reload = () => {
    invalidateConnectionQueries();
    queryClient.invalidateQueries({ queryKey: ["connections"] });
  };

  const dialect = useMemo(
    () => chooseDialect(currentConnection?.engine || null),
    [currentConnection?.engine]
  );

  const isLicenseActive = useMemo(() => {
    return licenseStatus?.valid === true;
  }, [licenseStatus]);

  const value = {
    reload,
    invalidateConnectionQueries,
    dialect,
    engine: currentConnection?.engine || "",
    licenseStatus,
    isLicenseActive,
    appVersion: appInfo?.version || "",
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};

