enum QueryType {
  Read = "read",
  Command = "command",
}

const READ_KEYWORDS = [
  "select",
  "show",
  "describe",
  "explain",
  "with",
  "watch",
  "pragma",
  "values",
  "table",
];

const readRegex = new RegExp(`^(${READ_KEYWORDS.join("|")})\\b`, "i");

function stripComments(query: string): string {
  // Strip single-line comments (--)
  let q = query.replace(/--[^\n]*/g, "");
  // Strip multi-line comments (/* */)
  q = q.replace(/\/\*[\s\S]*?\*\//g, "");
  return q.trim();
}

export function detectQueryType(query: string): QueryType {
  const q = stripComments(query).trim();

  if (!q) return QueryType.Command;

  if (readRegex.test(q)) {
    return QueryType.Read;
  }

  return QueryType.Command;
}
