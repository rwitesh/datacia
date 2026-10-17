import { isValidElement, memo, useEffect, useState, type ReactNode } from "react";
import Markdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { Browser } from "@wailsio/runtime";
import { Check, Copy, CornerDownLeft, SquarePlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useEditorContext } from "@/context/editor/Index";

// Model output is untrusted: raw HTML stays escaped and images aren't loaded.
const DISALLOWED = ["img"];

function openLink(href = "") {
  let url: URL;
  try {
    url = new URL(href);
  } catch {
    return;
  }
  if (url.protocol === "http:" || url.protocol === "https:") void Browser.OpenURL(url.href);
}

function CodeBlock({ code, language }: { code: string; language: string }) {
  const { activeTab, createTab, updateTab } = useEditorContext();
  const [copied, setCopied] = useState(false);
  const isSQL = language === "" || language.toLowerCase() === "sql";
  const canInsert = activeTab?.type === "query";

  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 1500);
    return () => clearTimeout(t);
  }, [copied]);

  const copy = () => navigator.clipboard.writeText(code).then(() => setCopied(true), () => setCopied(false));

  const insert = () => {
    if (activeTab?.type !== "query") return;
    const current = activeTab.sql.trimEnd();
    updateTab(activeTab.id, { sql: current ? `${current}\n\n${code}` : code });
  };

  const openInNewTab = () => {
    const tab = createTab(undefined, "query");
    updateTab(tab.id, { sql: code });
  };

  return (
    <div className="group/code mb-2 last:mb-0 rounded-md border border-border/60 bg-muted/40 overflow-hidden">
      <div className="flex items-center justify-between gap-2 px-2 h-6 border-b border-border/60 text-[10px] text-muted-foreground">
        <span className="font-mono uppercase tracking-wide">{language || "code"}</span>
        <div className="flex items-center gap-0.5">
          {isSQL && canInsert && (
            <CodeAction label="Insert into editor" onClick={insert}>
              <CornerDownLeft />
            </CodeAction>
          )}
          {isSQL && (
            <CodeAction label="Open in new tab" onClick={openInNewTab}>
              <SquarePlus />
            </CodeAction>
          )}
          <CodeAction label={copied ? "Copied" : "Copy"} onClick={copy}>
            {copied ? <Check className="text-emerald-500" /> : <Copy />}
          </CodeAction>
        </div>
      </div>
      <pre className="px-2.5 py-2 overflow-auto max-h-72 text-[11px] leading-relaxed font-mono whitespace-pre select-text">
        <code>{code}</code>
      </pre>
    </div>
  );
}

function CodeAction({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <Button size="icon-xs" variant="ghost" onClick={onClick} title={label} aria-label={label} className="size-5 cursor-pointer [&_svg]:size-3">
      {children}
    </Button>
  );
}

const components: Components = {
  p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
  strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
  h1: ({ children }) => <h1 className="text-sm font-semibold mb-2 mt-3 first:mt-0">{children}</h1>,
  h2: ({ children }) => <h2 className="text-[13px] font-semibold mb-1.5 mt-2.5 first:mt-0">{children}</h2>,
  h3: ({ children }) => <h3 className="font-semibold mb-1 mt-2 first:mt-0">{children}</h3>,
  ul: ({ children }) => <ul className="list-disc pl-4 mb-2 last:mb-0 space-y-0.5">{children}</ul>,
  ol: ({ children }) => <ol className="list-decimal pl-4 mb-2 last:mb-0 space-y-0.5">{children}</ol>,
  // Fenced blocks are rendered by `pre`, so this is inline code only.
  code: ({ children }) => (
    <code className="bg-muted rounded px-1 py-0.5 text-[11px] font-mono">{children}</code>
  ),
  // `children` is the fenced block's <code> element.
  pre: ({ children }) => {
    const { className = "", children: text = "" } = isValidElement<{ className?: string; children?: ReactNode }>(children)
      ? children.props
      : {};
    return <CodeBlock code={String(text).replace(/\n$/, "")} language={className.replace(/^language-/, "")} />;
  },
  a: ({ href, children }) => (
    <a
      href={href}
      onClick={(e) => {
        e.preventDefault();
        openLink(href);
      }}
      className="text-primary underline underline-offset-2 hover:opacity-80 cursor-pointer"
    >
      {children}
    </a>
  ),
  blockquote: ({ children }) => (
    <blockquote className="border-l-2 border-border pl-3 my-2 text-muted-foreground">{children}</blockquote>
  ),
  hr: () => <hr className="my-3 border-border/50" />,
  table: ({ children }) => (
    <div className="overflow-x-auto mb-2 last:mb-0">
      <table className="w-full text-[11px] border-collapse">{children}</table>
    </div>
  ),
  th: ({ children }) => (
    <th className="border border-border/50 px-2 py-1 text-left font-semibold bg-muted/50">{children}</th>
  ),
  td: ({ children }) => <td className="border border-border/50 px-2 py-1 align-top">{children}</td>,
};

export const MarkdownMessage = memo(function MarkdownMessage({ content }: { content: string }) {
  return (
    <Markdown
      remarkPlugins={[remarkGfm]}
      components={components}
      disallowedElements={DISALLOWED}
      unwrapDisallowed
    >
      {content}
    </Markdown>
  );
});
