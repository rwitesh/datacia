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
  return query.replace(/--[^\n]*/g, "").replace(/\/\*[\s\S]*?\*\//g, "").trim();
}

export function detectQueryType(query: string): "read" | "command" {
  return readRegex.test(stripComments(query)) ? "read" : "command";
}
