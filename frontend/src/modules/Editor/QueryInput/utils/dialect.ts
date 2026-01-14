import { SQLDialect } from "@codemirror/lang-sql";
import { getDialect } from "@/modules/utils/engines";

/**
 * Get the appropriate SQL dialect for CodeMirror based on the database engine
 * This uses the centralized engine configuration - no more manual if/else chains!
 */
export const chooseDialect = (engine: string | null): SQLDialect => {
  return getDialect(engine);
};
