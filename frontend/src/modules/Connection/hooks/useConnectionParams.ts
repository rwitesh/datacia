import { useMemo } from "react";
import { useLocation } from "react-router";
import type { DatabaseEngine } from "../utils/types";
import { postgres, clickhouse, mysql } from "../utils/types";

// Helper function to validate engine type
const isValidEngine = (engine: string): engine is DatabaseEngine => {
  return [postgres, clickhouse, mysql].includes(engine);
};

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
      return isValidEngine(engine || "") ? (engine as DatabaseEngine) : "clickhouse";
    } catch {
      return "clickhouse" as DatabaseEngine;
    }
  }, [location.search]);

  return { connectionId, engineParam };
};