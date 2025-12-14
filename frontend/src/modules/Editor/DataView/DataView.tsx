import { useMemo, useState } from "react";
import { Copy, Check } from "lucide-react";

type SelectedDataProps = {
  selectedData: Array<Record<string, unknown>>;
};

// Get color class for different JSON value types
function getColorClass(value: string): string {
  // Check for null
  if (value === "null") {
    return "text-red-500 dark:text-red-400";
  }

  // Check for booleans
  if (value === "true" || value === "false") {
    return "text-amber-600 dark:text-amber-400";
  }

  // Check for numbers
  if (/^-?\d+\.?\d*$/.test(value.trim())) {
    return "text-blue-600 dark:text-blue-400";
  }

  // Check for strings (wrapped in quotes)
  if (value.startsWith('"') && value.endsWith('"')) {
    return "text-emerald-600 dark:text-emerald-400";
  }

  // Default for structural characters like brackets, braces, commas
  return "text-muted-foreground";
}

// Highlight a single line of JSON
function HighlightedLine({ line }: { line: string }) {
  // Split by quotes to separate keys, values, and other parts
  const parts = line.split(/("(?:[^"\\]|\\.)*")/g);

  return (
    <>
      {parts.map((part, index) => {
        if (!part) return null;

        // Check if this part is a property key (followed by colon)
        const nextPart = parts[index + 1] || "";
        const isKey = part.startsWith('"') && nextPart.trim().startsWith(":");

        if (isKey) {
          return (
            <span key={index} className="text-purple-600 dark:text-purple-400">
              {part}
            </span>
          );
        }

        // Apply appropriate color based on content
        return (
          <span key={index} className={getColorClass(part)}>
            {part}
          </span>
        );
      })}
    </>
  );
}

export function DataView({ selectedData }: SelectedDataProps) {
  const [copied, setCopied] = useState(false);

  // Convert data to formatted JSON lines, compacting }, { onto same line
  const lines = useMemo(() => {
    const jsonString = JSON.stringify(selectedData, null, 2);
    // Compact: merge "  }," followed by "  {" into single line "  }, {"
    const compacted = jsonString.replace(/\},\n\s*\{/g, "}, {");
    return compacted.split("\n");
  }, [selectedData]);

  const handleCopy = async () => {
    try {
      const jsonString = JSON.stringify(selectedData, null, 2);
      await navigator.clipboard.writeText(jsonString);
      setCopied(true);
    } catch {
      // Silently fail
    }
  };

  const rowCount = selectedData.length;

  return (
    <div className="h-full w-full flex flex-col bg-gradient-to-b from-background to-muted/30">
      {/* Minimal Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border/50 bg-background/80 backdrop-blur-md">
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-primary/10 text-primary border border-primary/20">
          {rowCount} {rowCount === 1 ? 'row' : 'rows'}
        </span>
        <button
          type="button"
          aria-label="Copy JSON to clipboard"
          title={copied ? "Copied!" : "Copy to clipboard"}
          onClick={handleCopy}
          onPointerLeave={() => setCopied(false)}
          onBlur={() => setCopied(false)}
          className="p-1.5 rounded-md hover:bg-muted transition-all duration-200 group"
        >
          {copied ? (
            <Check className="w-3.5 h-3.5 text-emerald-500 transition-transform duration-200 scale-110" />
          ) : (
            <Copy className="w-3.5 h-3.5 text-muted-foreground group-hover:text-foreground transition-colors duration-200" />
          )}
          <span className="sr-only">
            {copied ? "Copied to clipboard" : "Copy JSON"}
          </span>
        </button>
      </div>

      {/* JSON Content */}
      <div className="flex-1 overflow-auto">
        <div className="p-4">
          <code className="block text-xs font-mono leading-relaxed">
            {lines.map((line, index) => (
              <div key={index} className="whitespace-pre-wrap break-words">
                <HighlightedLine line={line} />
              </div>
            ))}
          </code>
        </div>
      </div>
    </div>
  );
}
