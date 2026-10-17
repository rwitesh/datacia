import { useRef } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";

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
}

export function DataTabContent({ lines }: DataTabContentProps) {
  if (lines.length === 0) {
    return (
      <div className="p-4 flex items-center justify-center min-h-[4rem]">
        <p className="text-xs text-muted-foreground">Select rows in the table to view data</p>
      </div>
    );
  }
  return <HighlightedLines lines={lines} />;
}

// Virtualized: selecting a whole result can produce many thousands of lines.
function HighlightedLines({ lines }: DataTabContentProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const virtualizer = useVirtualizer({
    count: lines.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => 20,
    overscan: 20,
  });

  return (
    <div ref={scrollRef} className="h-full overflow-auto p-4">
      <code
        className="relative block font-mono text-xs leading-relaxed"
        style={{ height: virtualizer.getTotalSize() }}
      >
        {virtualizer.getVirtualItems().map((item) => (
          <div
            key={item.index}
            data-index={item.index}
            ref={virtualizer.measureElement}
            className="absolute left-0 w-full whitespace-pre-wrap break-words"
            style={{ transform: `translateY(${item.start}px)` }}
          >
            <HighlightedLine line={lines[item.index]} />
          </div>
        ))}
      </code>
    </div>
  );
}
