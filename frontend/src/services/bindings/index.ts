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
  OpenConnectionWindow,
  OpenLicenseWindow,
  OpenSettingsWindow,
} from "../../../bindings/datacia/pkg/remote/engine";

export {
  GetAppInfo,
} from "../../../bindings/datacia/internal/settings/service";

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

// AI service functions
export { SendMessage } from "./ai";
