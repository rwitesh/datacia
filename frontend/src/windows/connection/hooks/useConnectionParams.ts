import { useSearchParams } from "react-router";
import { isValidEngine, CLICKHOUSE } from "@/shared/utils/engines";

export const useConnectionParams = () => {
  const [searchParams] = useSearchParams();
  const connectionId = searchParams.get("id") ?? "";
  const engine = searchParams.get("engine");
  const engineParam = isValidEngine(engine) ? engine : CLICKHOUSE;

  return { connectionId, engineParam };
};
