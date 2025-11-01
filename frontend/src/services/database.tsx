import {
  RunQuery as WRunQuery,
} from "../../bindings/layerbits/pkg/clickhouse/clickhouse.js";
import { QueryResult } from "../../bindings/layerbits/pkg/clickhouse/models.js";
import { detectQueryType } from "./utils.js";
export { QueryResult };
import { v4 as uuidv4 } from "uuid";

export async function RunQuery(
  sql: string,
  queryID?: string
): Promise<QueryResult> {
  const t = detectQueryType(sql);
  const id = queryID ?? uuidv4();
  return WRunQuery(id, t, sql);
}

