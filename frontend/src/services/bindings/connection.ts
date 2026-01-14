import { type DatabaseEngine } from "@/modules/utils/engines";
import {
  SaveConnection as WSaveConnection,
  DeleteConnection as WDeleteConnection,
  CreateNewConnectionWithSSH as WCreateNewConnectionWithSSH,
  CloseCurrentConnection as WCloseCurrentConnection,
  EstablishConnection as WEstablishConnection,
  ChangeDatabase as WChangeDatabase,
  ChangeDatabaseByName as WChangeDatabaseByName,
  UpdateConnection as WUpdateConnection,
  SelectSSHKeyFile as WSelectSSHKeyFile,
  SelectSQLiteFile as WSelectSQLiteFile,
  CheckConnectionHealth as WCheckConnectionHealth
} from "./index";


export const CreateNewConnection = (engine: DatabaseEngine, host: string, port: string, username: string, password: string, database: string, useSSH: string = "", sshHost: string = "", sshPort: string = "", sshUsername: string = "", sshPassword: string = "", sshKeyPath: string = "") => {
  return WCreateNewConnectionWithSSH(engine, host, port, username, password, database, useSSH, sshHost, sshPort, sshUsername, sshPassword, sshKeyPath, false);
};

export const TestNewConnection = (engine: DatabaseEngine, host: string, port: string, username: string, password: string, database: string, useSSH: string = "", sshHost: string = "", sshPort: string = "", sshUsername: string = "", sshPassword: string = "", sshKeyPath: string = "") => {
  return WCreateNewConnectionWithSSH(engine, host, port, username, password, database, useSSH, sshHost, sshPort, sshUsername, sshPassword, sshKeyPath, true);
};

export const SelectSSHKeyFile = () => {
  return WSelectSSHKeyFile();
};

export const ChangeDatabase = (engine: DatabaseEngine, host: string, port: string, username: string, password: string, database: string) => {
  return WChangeDatabase(engine, host, port, username, password, database);
}

export const ChangeDatabaseByName = (database: string) => {
  return WChangeDatabaseByName(database);
}

export const EstablishConnection = (id: string) => {
  return WEstablishConnection(id);
}

export const CloseCurrentConnection = (closeEditor: boolean = true) => {
  return WCloseCurrentConnection(closeEditor);
};

export const SaveConnection = (name: string, config: { [key: string]: string }) => {
  return WSaveConnection(name, config);
};

export const UpdateConnection = (id: string, name: string, config: { [key: string]: string }) => {
  return WUpdateConnection(id, name, config);
}

export const DeleteConnection = (id: string) => {
  return WDeleteConnection(id);
}

export const SelectSQLiteFile = () => {
  return WSelectSQLiteFile();
}

export const CheckConnectionHealth = () => {
  return WCheckConnectionHealth();
}
