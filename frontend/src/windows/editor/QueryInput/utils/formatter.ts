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

  try {
    return format(sql, {
      language: getFormatterLanguage(engine),
      tabWidth: 2,
      useTabs: true,
      dataTypeCase: "upper",
      logicalOperatorNewline: 'before',
      linesBetweenQueries: 2,
    } as FormatOptionsWithLanguage);
  } catch (error) {
    // If formatting fails, return original SQL
    console.error("SQL formatting error:", error);
    return sql;
  }
};
