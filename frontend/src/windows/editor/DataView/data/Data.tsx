function getColorClass(value: string): string {
  if (value === "null") {
    return "text-red-500 dark:text-red-400";
  }

  if (value === "true" || value === "false") {
    return "text-amber-600 dark:text-amber-400";
  }

  if (/^-?\d+\.?\d*$/.test(value.trim())) {
    return "text-blue-600 dark:text-blue-400";
  }

  if (value.startsWith('"') && value.endsWith('"')) {
    return "text-emerald-600 dark:text-emerald-400";
  }

  return "text-muted-foreground";
}

function HighlightedLine({ line }: { line: string }) {
  const parts = line.split(/("(?:[^"\\]|\\.)*")/g);

  return (
    <>
      {parts.map((part, index) => {
        if (!part) return null;

        const nextPart = parts[index + 1] || "";
        const isKey = part.startsWith('"') && nextPart.trim().startsWith(":");

        if (isKey) {
          return (
            <span key={index} className="text-purple-600 dark:text-purple-400">
              {part}
            </span>
          );
        }

        return (
          <span key={index} className={getColorClass(part)}>
            {part}
          </span>
        );
      })}
    </>
  );
}

export interface DataTabContentProps {
  lines: string[];
  disabled?: boolean;
}

export function DataTabContent({ lines, disabled }: DataTabContentProps) {
  if (lines.length === 0) {
    return (
      <div className="p-4 flex items-center justify-center min-h-[4rem]">
        <p className="text-xs text-muted-foreground">Select rows in the table to view data</p>
      </div>
    );
  }
  return (
    <div
      className={`p-4 ${disabled ? "blur-sm select-none pointer-events-none" : ""}`}
    >
      <code className="block text-xs font-mono leading-relaxed">
        {lines.map((line, index) => (
          <div key={index} className="whitespace-pre-wrap break-words">
            <HighlightedLine line={line} />
          </div>
        ))}
      </code>
    </div>
  );
}
