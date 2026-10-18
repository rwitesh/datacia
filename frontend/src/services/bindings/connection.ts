import {
  SaveConnection as WSaveConnection,
  DeleteConnection as WDeleteConnection,
  Connect as WConnect,
  TestConnection as WTestConnection,
  CloseCurrentConnection as WCloseCurrentConnection,
  EstablishConnection as WEstablishConnection,
  ChangeDatabaseByName as WChangeDatabaseByName,
  UpdateConnection as WUpdateConnection,
  SelectSSHKeyFile as WSelectSSHKeyFile,
  SelectSQLiteFile as WSelectSQLiteFile,
  CheckConnectionHealth as WCheckConnectionHealth,
  type ConnectionConfig,
} from "./index";


export const Connect = (config: ConnectionConfig) => {
  return WConnect(config);
};

export const TestConnection = (config: ConnectionConfig) => {
  return WTestConnection(config);
};

export const SelectSSHKeyFile = () => {
  return WSelectSSHKeyFile();
};

export const ChangeDatabaseByName = (database: string) => {
  return WChangeDatabaseByName(database);
}

export const EstablishConnection = (id: string) => {
  return WEstablishConnection(id);
}

export const CloseCurrentConnection = (closeEditor: boolean = true) => {
  return WCloseCurrentConnection(closeEditor);
};

export const SaveConnection = (config: ConnectionConfig) => {
  return WSaveConnection(config);
};

export const UpdateConnection = (config: ConnectionConfig) => {
  return WUpdateConnection(config);
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
