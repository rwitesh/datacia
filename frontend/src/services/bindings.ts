// Services
export { FileService } from "../../bindings/datacia/internal/files";
export { ClipboardService } from "../../bindings/datacia/internal/clipboard";
export { ConnectionInfo, QueryType } from "../../bindings/datacia/pkg/common";
export type { QueryResult } from "../../bindings/datacia/pkg/common/models";
export type { FileNode } from "../../bindings/datacia/internal/queries/models";
export type { QueryHistoryItem } from "../../bindings/datacia/internal/db/models";

// Re-export all functions from remote engine
export {
  RunQuery,
  GetTableData,
  GetTableSchema,
  GetQueryHistory,
  ListConnections,
  LoadConnection,
  ListDatabases,
  ListTables,
  CancelQuery,
  CheckForUpdates,
  Update,
  GetCurrentConnectionInfo,
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
  GetStore,
  SetApplication,
} from "../../bindings/datacia/pkg/remote/engine";

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
} from "../../bindings/datacia/internal/queries/queriesservice";
