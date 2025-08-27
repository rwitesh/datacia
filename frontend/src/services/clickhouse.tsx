import {
  Connect as WConnect,
  Close as WClose,
  Ping as WPing,
  RunQuery as WRunQuery,
  FetchDatabases as WFetchDatabases,
  FetchTables as WFetchTables,
  ChangeDatabase as WChangeDatabase,
  CancelQuery as WCancelQuery,
} from "../../bindings/layerbit/pkg/clickhouse/clickhouse.js";
import { QueryResult } from "../../bindings/layerbit/pkg/clickhouse/models.js";
import { detectQueryType } from "./utils.js";
export { QueryResult };

export async function Connect(
  host: string,
  port: number,
  username: string,
  password: string,
  database: string
) {
  return WConnect(host, port, username, password, database);
}

export async function Close(): Promise<void> {
  return WClose();
}

export async function Ping(): Promise<void> {
  return WPing();
}

export async function ChangeDatabase(database: string): Promise<void> {
  return WChangeDatabase(database);
}

export async function ListDatabases(): Promise<string[]> {
  return WFetchDatabases();
}

export async function ListTables(database: string): Promise<string[]> {
  return WFetchTables(database);
}

export async function RunQuery(
  queryID: string,
  sql: string
): Promise<QueryResult> {
  const t = detectQueryType(sql);
  return WRunQuery(queryID, t, sql);
}

export async function CancelQuery(queryID: string): Promise<void> {
  return WCancelQuery(queryID);
}
