import { format, type FormatOptionsWithLanguage } from "sql-formatter";
import { getFormatterLanguage } from "@/shared/utils/engines";

/**
 * Formats SQL query using sql-formatter library
 * Engine-specific formatting is handled automatically via centralized config
 * 
 * @param sql - The SQL query to format
 * @param engine - Database engine type for dialect-specific formatting
 * @returns Formatted SQL string
 */
export const formatSQL = (sql: string, engine: string): string => {
  if (!sql) return "";

  const formatterLanguage = getFormatterLanguage(engine);

  try {
    return format(sql, {
      language: formatterLanguage,
      tabWidth: 2,
      useTabs: true,
      // ClickHouse type names are case-sensitive (UInt64, not UINT64).
      dataTypeCase: formatterLanguage === "clickhouse" ? "preserve" : "upper",
      logicalOperatorNewline: 'before',
      linesBetweenQueries: 2,
    } as FormatOptionsWithLanguage);
  } catch (error) {
    // If formatting fails, return original SQL
    console.error("SQL formatting error:", error);
    return sql;
  }
};
