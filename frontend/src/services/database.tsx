import {
  RunQuery as WRunQuery,
  GetTableData as WGetTableData,
  GetTableSchema as WGetTableSchema,
  GetQueryHistory as WGetQueryHistory,
} from "../../bindings/datacia/pkg/remote/engine.js";
import { QueryResult } from "../../bindings/datacia/pkg/common/models.js";
import { QueryHistoryItem } from "../../bindings/datacia/internal/db/models.js";
import { detectQueryType } from "./utils.js";
export { QueryResult, QueryHistoryItem };
import { v4 as uuidv4 } from "uuid";

export async function RunQuery(
  sql: string,
  queryID?: string
): Promise<QueryResult> {
  const t = detectQueryType(sql);
  const id = queryID ?? uuidv4();
  return WRunQuery(id, t, sql);
}

export async function GetTableData(
  table: string,
  limit: number,
  offset: number,
  orderBy?: string,
  orderDir?: string
): Promise<QueryResult> {
  return WGetTableData(table, limit, offset, orderBy ?? "", orderDir ?? "");
}

export async function GetTableSchema(table: string): Promise<QueryResult> {
  return WGetTableSchema(table);
}

export async function GetQueryHistory(limit: number) {
  return WGetQueryHistory(limit);
}

