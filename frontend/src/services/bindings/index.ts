// Re-export all bindings from the generated bindings directory

export { ConnectionInfo } from "../../../bindings/datacia/pkg/common";
export type { QueryResult } from "../../../bindings/datacia/pkg/common/models";
export type { FileNode } from "../../../bindings/datacia/internal/queries/models";
export type { QueryHistoryItem } from "../../../bindings/datacia/internal/db/models";

// Re-export all functions from remote engine
export {
  RunQuery,
  GetTableData,
  GetTableSchema,
  GetDDL,
  GetQueryHistory,
  ListConnections,
  LoadConnection,
  ListDatabases,
  ListTables,
  CancelQuery,
  CheckForUpdates,
  Update,
  RestartApp,
  GetCurrentConnectionInfo,
  GetAppInfo,
  // Connection management functions
  SaveConnection,
  DeleteConnection,
  CreateNewConnection,
  CreateNewConnectionWithSSH,
  CloseCurrentConnection,
  EstablishConnection,
  ChangeDatabase,
  ChangeDatabaseByName,
  UpdateConnection,
  SelectSSHKeyFile,
  SelectSQLiteFile,
  CheckConnectionHealth,
  // Additional functions

} from "../../../bindings/datacia/pkg/remote/engine";

// Query service functions
export {
  ListTree,
  CreateFolder,
  CreateQueryFile,
  Rename,
  Delete,
  ReadFile,
  WriteFile,
  Move,
} from "../../../bindings/datacia/internal/queries/queriesservice";
