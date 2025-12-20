import ClickhouseIcon from "@/assets/clickhouse.svg";
import PostgreSQLIcon from "@/assets/postgres.svg";
import MySQLIcon from "@/assets/mysql.svg";
import SQLiteIcon from "@/assets/sqlite.svg";

// Engine constants
export const POSTGRES = "postgres" as const;
export const CLICKHOUSE = "clickhouse" as const;
export const MYSQL = "mysql" as const;
export const SQLITE = "sqlite" as const;

export type DatabaseEngine = typeof POSTGRES | typeof CLICKHOUSE | typeof MYSQL | typeof SQLITE;

// Engine config
export const DATABASE_ENGINES: Record<DatabaseEngine, { label: string; icon: string; defaultPort: string }> = {
  [POSTGRES]: { label: "PostgreSQL", icon: PostgreSQLIcon, defaultPort: "5432" },
  [CLICKHOUSE]: { label: "ClickHouse", icon: ClickhouseIcon, defaultPort: "9000" },
  [MYSQL]: { label: "MySQL", icon: MySQLIcon, defaultPort: "3306" },
  [SQLITE]: { label: "SQLite", icon: SQLiteIcon, defaultPort: "" },
};

// For iteration
export const ENGINE_LIST = Object.entries(DATABASE_ENGINES).map(([id, config]) => ({ id: id as DatabaseEngine, ...config }));
export const ENGINE_IDS = Object.keys(DATABASE_ENGINES) as DatabaseEngine[];

// Validation helper
export const isValidEngine = (engine: string | null | undefined): engine is DatabaseEngine => {
  return !!engine && engine in DATABASE_ENGINES;
};
