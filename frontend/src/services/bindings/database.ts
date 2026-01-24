import {
  RunQuery as WRunQuery,
  GetTableData as WGetTableData,
  GetTableSchema as WGetTableSchema,
  GetDDL as WGetDDL,
  GetQueryHistory as WGetQueryHistory,
} from "./index";
import type { QueryResult, QueryHistoryItem } from "./index";
import { detectQueryType } from "./utils";
export type { QueryResult, QueryHistoryItem };
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

export async function GetDDL(table: string): Promise<string> {
  if (!table?.trim()) {
    throw new Error("Table name cannot be empty");
  }
  return WGetDDL(table);
}

export async function GetQueryHistory(limit: number) {
  return WGetQueryHistory(limit);
}
