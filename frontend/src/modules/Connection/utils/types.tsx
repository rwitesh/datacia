export const postgres = "postgres";
export const clickhouse = "clickhouse";

export type DatabaseEngine = typeof postgres | typeof clickhouse;

export type FormValues = {
  connectionName: string;
  engine: DatabaseEngine;
  host: string;
  port: string;
  username: string;
  password: string;
  database: string;
};

export type Status =
  | {
      kind: "success";
      title: string;
      description?: string;
    }
  | {
      kind: "error";
      title: string;
      description?: string;
    }
  | {
      kind: "info";
      title: string;
      description?: string;
    }
  | null;