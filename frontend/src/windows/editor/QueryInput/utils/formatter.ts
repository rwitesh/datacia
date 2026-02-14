import { format, type FormatOptionsWithLanguage } from "sql-formatter";
import { getFormatterLanguage } from "@/shared/utils/engines";


function normalizeSQL(sql: string): string {
  // Replace `identifier` with "identifier", escaping any " inside
  return sql.replace(/`([^`]*)`/g, (_, ident) => `"${ident.replace(/"/g, '""')}"`);
}

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
  const normalized = normalizeSQL(sql);

  try {
    return format(normalized, {
      language: formatterLanguage,
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
