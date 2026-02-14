import React, { useCallback, useMemo, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Events } from "@wailsio/runtime";
import { AppContext } from "./Context";
import { chooseDialect } from "@/windows/editor/QueryInput/utils/dialect";
import { useCurrentConnection } from "@/services/connections";
import { useLicenseStatus } from "@/services/license";
import { useSettings } from "@/services/settings";

export const AppProvider = ({ children }: { children: React.ReactNode }) => {
  const queryClient = useQueryClient();
  const { data: currentConnection } = useCurrentConnection();
  const { data: licenseStatus } = useLicenseStatus();
  const { data: settings } = useSettings();

  const invalidateConnectionQueries = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["tables"] });
    queryClient.invalidateQueries({ queryKey: ["databases"] });
    queryClient.invalidateQueries({ queryKey: ["queries-tree"] });
    queryClient.invalidateQueries({ queryKey: ["query-history"] });
    queryClient.invalidateQueries({ queryKey: ["connection-health"] });
    queryClient.invalidateQueries({ queryKey: ["current-connection"] });
    queryClient.invalidateQueries({ queryKey: ["license-status"] });
  }, [queryClient]);

  const reload = () => {
    invalidateConnectionQueries();
    queryClient.invalidateQueries({ queryKey: ["connections"] });
  };

  useEffect(() => {
    const unsubscribe = Events.On("connection-changed", () => {
      invalidateConnectionQueries();
    });
    return () => unsubscribe();
  }, [invalidateConnectionQueries]);

  useEffect(() => {
    const unsubscribe = Events.On("license-changed", () => {
      queryClient.refetchQueries({ queryKey: ["license-status"] });
    });
    return () => unsubscribe();
  }, [queryClient]);

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
    appVersion: settings?.app_version ?? "",
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};

