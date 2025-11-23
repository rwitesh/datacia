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

  // Convert data to formatted JSON lines
  const lines = useMemo(() => {
    const jsonString = JSON.stringify(selectedData, null, 2);
    return jsonString.split("\n");
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

  if (!selectedData.length) {
    return (
      <div className="p-4 text-muted-foreground text-sm">No rows selected</div>
    );
  }

  const rowCount = selectedData.length;

  return (
    <div className="h-full w-full flex flex-col bg-muted">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-background/50 backdrop-blur-sm">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Selected Data</h3>
          <p className="text-xs text-muted-foreground">
            {rowCount} {rowCount === 1 ? 'row' : 'rows'} selected
          </p>
        </div>
        <button
          type="button"
          aria-label="Copy JSON to clipboard"
          title={copied ? "Copied!" : "Copy to clipboard"}
          onClick={handleCopy}
          onPointerLeave={() => setCopied(false)}
          onBlur={() => setCopied(false)}
          className="p-2 rounded-md hover:bg-muted/80 transition-colors"
        >
          {copied ? (
            <Check className="w-4 h-4 text-green-500" />
          ) : (
            <Copy className="w-4 h-4 text-muted-foreground" />
          )}
          <span className="sr-only">
            {copied ? "Copied to clipboard" : "Copy JSON"}
          </span>
        </button>
      </div>

      {/* JSON Content */}
      <div className="flex-1 overflow-auto">
        <div className="p-4 min-w-max">
          <code className="block text-xs font-mono leading-relaxed">
            {lines.map((line, index) => (
              <div key={index} className="whitespace-pre">
                <HighlightedLine line={line} />
              </div>
            ))}
          </code>
        </div>
      </div>
    </div>
  );
}
