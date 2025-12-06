import { MySQL, PostgreSQL, SQLDialect, SQLite, StandardSQL } from "@codemirror/lang-sql";
import { ClickhouseDialect } from "../dialect/clickhouse";

export const chooseDialect = (engine: string | null): SQLDialect => {
    console.log(engine)
    if (engine === "clickhouse") return ClickhouseDialect;
    if (engine === "postgres") return PostgreSQL;
    if (engine === "mysql") return MySQL;
    if (engine === "sqlite") return SQLite;
    return StandardSQL;
};
