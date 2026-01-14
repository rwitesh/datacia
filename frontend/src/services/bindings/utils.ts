enum QueryType {
  Read = "read",
  Command = "command",
  Unknown = "unknown",
}

const readRegex = /^(select|show|describe|explain|with|watch)\b/i;
const commandRegex =
  /^(insert|create|alter|drop|truncate|optimize|grant|revoke|set|attach|detach|rename|use|system|kill)\b/i;

export function detectQueryType(query: string): QueryType {
  let q = query.trim();

  const idx = q.indexOf("--");
  if (idx !== -1) {
    q = q.substring(0, idx).trim();
  }

  if (readRegex.test(q)) {
    return QueryType.Read;
  }
  if (commandRegex.test(q)) {
    return QueryType.Command;
  }
  return QueryType.Unknown;
}
