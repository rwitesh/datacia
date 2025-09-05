import { Sync as WSync, GetTabs as WGetTabs, SaveConnection as WSaveConnection, DeleteConnection as WDeleteConnection, CreateNewConnection as WCreateNewConnection, CloseCurrentConnection as WCloseCurrentConnection, EstablishConnection as WEstablishConnection, ChangeDatabase as WChangeDatabase} from "../../bindings/layerbit/pkg/remote/engine.ts";

export const SyncData = (activeTabId: string, data: string) => {
  if (!activeTabId) return;
  return WSync(activeTabId, data);
};

export const GetTabData = () => {
  return WGetTabs();
};

export const CreateNewConnection = (host: string, port: string, username: string, password: string, database: string) => {
  return WCreateNewConnection( host, port, username, password, database, false, true);
};

export const TestNewConnection = (host: string, port: string, username: string, password: string, database: string) => {
  return WCreateNewConnection( host, port, username, password, database, true, false);
};

export const ChangeDatabase = (host: string, port: string, username: string, password: string, database: string) => {
  return WChangeDatabase(host, port, username, password, database);
}

export const EstablishConnection = (name: string) => {
  return WEstablishConnection(name);
}

export const CloseCurrentConnection = () => {
  return WCloseCurrentConnection();
};

export const SaveConnection = (name: string, config: { [key: string]: string }) => {
  return WSaveConnection(name, config);
};

export const DeleteConnection = (name: string) => {
  return WDeleteConnection(name);
}