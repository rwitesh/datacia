import ClickhouseIcon from "@/assets/clickhouse.svg";
import PostgreSQLIcon from "@/assets/postgres.svg";
import MySQLIcon from "@/assets/mysql.svg";
import SQLiteIcon from "@/assets/sqlite.svg";
import { MySQL, PostgreSQL, SQLDialect, SQLite, StandardSQL } from "@codemirror/lang-sql";
import { ClickhouseDialect } from "@/windows/editor/QueryInput/dialects/clickhouse";


export const POSTGRES = "postgres" as const;
export const CLICKHOUSE = "clickhouse" as const;
export const MYSQL = "mysql" as const;
export const SQLITE = "sqlite" as const;

export type DatabaseEngine = typeof POSTGRES | typeof CLICKHOUSE | typeof MYSQL | typeof SQLITE;

interface EngineConfig {
  label: string;              // Display name
  icon: string;               // Icon/logo path
  defaultPort: string;        // Default connection port
  formatterLanguage: string;  // sql-formatter language identifier
  dialect: SQLDialect;        // CodeMirror SQL dialect for syntax highlighting
}

export const DATABASE_ENGINES: Record<DatabaseEngine, EngineConfig> = {
  [POSTGRES]: {
    label: "PostgreSQL",
    icon: PostgreSQLIcon,
    defaultPort: "5432",
    formatterLanguage: "postgresql",
    dialect: PostgreSQL,
  },
  [CLICKHOUSE]: {
    label: "ClickHouse",
    icon: ClickhouseIcon,
    defaultPort: "9000",
    formatterLanguage: "clickhouse",
    dialect: ClickhouseDialect,
  },
  [MYSQL]: {
    label: "MySQL",
    icon: MySQLIcon,
    defaultPort: "3306",
    formatterLanguage: "mysql",
    dialect: MySQL,
  },
  [SQLITE]: {
    label: "SQLite",
    icon: SQLiteIcon,
    defaultPort: "",
    formatterLanguage: "sqlite",
    dialect: SQLite,
  },
};


/**
 * Get engine configuration safely with fallback
 */
export const getEngineConfig = (engine: string | null | undefined): EngineConfig => {
  if (isValidEngine(engine)) {
    return DATABASE_ENGINES[engine];
  }
  // Fallback for unknown engines
  return {
    label: "Unknown",
    icon: "",
    defaultPort: "",
    formatterLanguage: "sql",
    dialect: StandardSQL,
  };
};

/**
 * Get SQL dialect for CodeMirror based on engine
 */
export const getDialect = (engine: string | null | undefined): SQLDialect => {
  return getEngineConfig(engine).dialect;
};

/**
 * Get formatter language for sql-formatter library
 */
export const getFormatterLanguage = (engine: string | null | undefined): string => {
  return getEngineConfig(engine).formatterLanguage;
};

// For iteration (e.g., in dropdowns, lists)
export const ENGINE_LIST = Object.entries(DATABASE_ENGINES).map(([id, config]) => ({
  id: id as DatabaseEngine,
  ...config,
}));

export const ENGINE_IDS = Object.keys(DATABASE_ENGINES) as DatabaseEngine[];

// Validation helper - Type guard to check if string is a valid engine
export const isValidEngine = (engine: string | null | undefined): engine is DatabaseEngine => {
  return !!engine && engine in DATABASE_ENGINES;
};
