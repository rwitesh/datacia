import { format, type FormatOptionsWithLanguage } from "sql-formatter";
import { getFormatterLanguage } from "@/shared/utils/engines";

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
      logicalOperatorNewline: "before",
      linesBetweenQueries: 2,
    } as FormatOptionsWithLanguage);
  } catch {
    // Unparseable SQL (or a dialect the formatter lacks) stays as typed.
    return sql;
  }
};
