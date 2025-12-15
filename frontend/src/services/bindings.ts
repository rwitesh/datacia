// Services
import { FileService } from "../../bindings/datacia/internal/files";
import { ClipboardService } from "../../bindings/datacia/internal/clipboard";
import { ConnectionInfo, ConnectionHealth, QueryType } from "../../bindings/datacia/pkg/common";
import type { QueryResult } from "../../bindings/datacia/pkg/common/models";
import type { FileNode } from "../../bindings/datacia/internal/queries/models";
import type { QueryHistoryItem } from "../../bindings/datacia/internal/db/models";
import * as RemoteEngine from "../../bindings/datacia/pkg/remote/engine";
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

// Re-export services
export { FileService, ClipboardService };
export { RemoteEngine };
export type { FileNode, ConnectionInfo, ConnectionHealth, QueryResult, QueryHistoryItem };
export { QueryType };
