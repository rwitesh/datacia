import { CloseCurrentConnection as WCloseCurrentConnection } from "./index";

export {
  SaveConnection,
  DeleteConnection,
  Connect,
  TestConnection,
  EstablishConnection,
  ChangeDatabaseByName,
  UpdateConnection,
  SelectSSHKeyFile,
  SelectSQLiteFile,
  CheckConnectionHealth,
} from "./index";

export const CloseCurrentConnection = (closeEditor: boolean = true) => {
  return WCloseCurrentConnection(closeEditor);
};
