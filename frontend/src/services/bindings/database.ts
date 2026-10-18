import {
  RunQuery as WRunQuery,
  GetTableData as WGetTableData,
  GetDDL as WGetDDL,
} from "./index";
import type { QueryResult, QueryHistoryItem } from "./index";
import { detectQueryType } from "./utils";
export { GetTableSchema, GetQueryHistory } from "./index";
export type { QueryResult, QueryHistoryItem };

export async function RunQuery(sql: string, queryID: string): Promise<QueryResult> {
  return WRunQuery(queryID, detectQueryType(sql), sql);
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

export async function GetDDL(table: string): Promise<string> {
  if (!table?.trim()) {
    throw new Error("Table name cannot be empty");
  }
  return WGetDDL(table);
}
