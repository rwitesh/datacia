import { MySQL, PostgreSQL, SQLDialect, SQLite, StandardSQL } from "@codemirror/lang-sql";
import { CLICKHOUSE, POSTGRES, MYSQL, SQLITE } from "@/modules/utils/engines";
import { ClickhouseDialect } from "../dialect/clickhouse";

export const chooseDialect = (engine: string | null): SQLDialect => {
    if (engine === CLICKHOUSE) return ClickhouseDialect;
    if (engine === POSTGRES) return PostgreSQL;
    if (engine === MYSQL) return MySQL;
    if (engine === SQLITE) return SQLite;
    return StandardSQL;
};
