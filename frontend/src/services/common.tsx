import type { DatabaseEngine } from "@/modules/Connection/utils/types.tsx";
import { SaveConnection as WSaveConnection, DeleteConnection as WDeleteConnection, CreateNewConnection as WCreateNewConnection, CloseCurrentConnection as WCloseCurrentConnection, EstablishConnection as WEstablishConnection, ChangeDatabase as WChangeDatabase, ChangeDatabaseByName as WChangeDatabaseByName, UpdateConnection as WUpdateConnection} from "../../bindings/layerbits/pkg/remote/engine.ts";


export const CreateNewConnection = (engine: DatabaseEngine, host: string, port: string, username: string, password: string, database: string) => {
  return WCreateNewConnection(engine, host, port, username, password, database, false, true);
};

export const TestNewConnection = (engine: DatabaseEngine, host: string, port: string, username: string, password: string, database: string) => {
  return WCreateNewConnection(engine, host, port, username, password, database, true, false);
};

export const ChangeDatabase = (engine: DatabaseEngine, host: string, port: string, username: string, password: string, database: string) => {
  return WChangeDatabase(engine, host, port, username, password, database);
}

export const ChangeDatabaseByName = (database: string) => {
  return WChangeDatabaseByName(database);
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

export const UpdateConnection = (id: string, name: string, config: { [key: string]: string }) => {
  return WUpdateConnection(id, name, config);
}

export const DeleteConnection = (id: string) => {
  return WDeleteConnection(id);
}