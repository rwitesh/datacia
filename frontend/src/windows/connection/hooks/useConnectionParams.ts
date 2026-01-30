import { useMemo } from "react";
import { useLocation } from "react-router";
import { isValidEngine, CLICKHOUSE, type DatabaseEngine } from "@/shared/utils/engines";

export const useConnectionParams = () => {
  const location = useLocation();

  const connectionId = useMemo(() => {
    try {
      const params = new URLSearchParams(location.search);
      return params.get("id") ?? "";
    } catch {
      return "";
    }
  }, [location.search]);

  const engineParam = useMemo(() => {
    try {
      const params = new URLSearchParams(location.search);
      const engine = params.get("engine");
      return isValidEngine(engine) ? engine : CLICKHOUSE;
    } catch {
      return CLICKHOUSE as DatabaseEngine;
    }
  }, [location.search]);

  return { connectionId, engineParam };
};
