import {
  Connect as WConnect,
  Close as WClose,
  ExecuteQuery as WExecuteQuery,  
  FetchDatabases as WFetchDatabases,
  FetchTables as WFetchTables,
  ChangeDatabase as WChangeDatabase,
  Cancel as WCancel,
} from "../../wailsjs/go/clickhouse/ClickHouse";

export async function Connect(host: string, port: number, username: string, password: string, database: string) {
  return WConnect(host, port, username, password, database);
}

export async function Close(): Promise<void> {
  return WClose();
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

export async function RunQuery(sql: string): Promise<any[]> {
  return WExecuteQuery(sql);
}

export async function Cancel(): Promise<void> {
  return WCancel();
}
