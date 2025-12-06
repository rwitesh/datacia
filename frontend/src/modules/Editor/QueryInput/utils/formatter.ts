export const formatSQL = (sql: string): string => {
    if (!sql) return "";

    const newLineKeywords = [
        "SELECT",
        "FROM",
        "WHERE",
        "GROUP BY",
        "HAVING",
        "ORDER BY",
        "LIMIT",
        "OFFSET",
        "UNION",
        "INSERT INTO",
        "VALUES",
        "UPDATE",
        "SET",
        "DELETE FROM",
        "CREATE TABLE",
        "DROP TABLE",
        "ALTER TABLE",
        "WITH",
    ];

    const indentKeywords = [
        "LEFT JOIN",
        "RIGHT JOIN",
        "INNER JOIN",
        "OUTER JOIN",
        "JOIN",
        "AND",
        "OR",
        "ON",
    ];

    let formatted = sql.replace(/\s+/g, " ").trim();

    const parts = formatted.split("'");

    for (let i = 0; i < parts.length; i += 2) {
        let part = parts[i];

        newLineKeywords.forEach((kw) => {
            const regex = new RegExp(`\\b${kw}\\b`, "gi");
            part = part.replace(regex, (m) => `\n${m}`);
        });

        indentKeywords.forEach((kw) => {
            const regex = new RegExp(`\\b${kw}\\b`, "gi");
            part = part.replace(regex, (m) => `\n  ${m}`);
        });

        part = part.replace(/,/g, ",\n ");

        parts[i] = part;
    }

    formatted = parts.join("'").replace(/\n\s*\n/g, "\n");

    return formatted.trim();
};
