import {
  Connect as WConnect,
  Close as WClose,
  Ping as WPing,
  RunQuery as WRunQuery,
  RunQueryWithID as WRunQueryWithID,  
  FetchDatabases as WFetchDatabases,
  FetchTables as WFetchTables,
  ChangeDatabase as WChangeDatabase,
  CancelQuery as WCancelQuery,
} from "../../wailsjs/go/clickhouse/ClickHouse";

export async function Connect(host: string, port: number, username: string, password: string, database: string) {
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

export async function RunQuery(queryID: string, sql: string): Promise<any[]> {
  return queryID ? WRunQueryWithID(queryID, sql) : WRunQuery(sql);
}

export async function CancelQuery(queryID: string): Promise<void> {
  return WCancelQuery(queryID);
}
