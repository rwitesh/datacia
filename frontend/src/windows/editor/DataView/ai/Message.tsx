import { AlertTriangle } from "lucide-react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";

export function AssistantMessage({
  content,
  error,
}: {
  content?: string;
  error?: string;
}) {
  const hasContent = content?.trim();
  const hasError = error?.trim();

  if (hasError) {
    return (
      <div className="rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2">
        <div className="flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 text-destructive flex-shrink-0 mt-0.5" />
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-medium text-destructive">Something went wrong</p>
            <p className="text-[11px] text-destructive/90 mt-0.5 break-words">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  if (!hasContent) return null;

  return (
    <Markdown
      remarkPlugins={[remarkGfm]}
      rehypePlugins={[rehypeRaw]}
      components={{
        p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
        strong: ({ children }) => (
          <strong className="font-semibold text-foreground">{children}</strong>
        ),
        em: ({ children }) => <em className="italic">{children}</em>,
        h1: ({ children }) => (
          <h1 className="text-sm font-semibold mb-2 mt-3 first:mt-0">
            {children}
          </h1>
        ),
        h2: ({ children }) => (
          <h2 className="text-[13px] font-semibold mb-1.5 mt-2.5 first:mt-0">
            {children}
          </h2>
        ),
        h3: ({ children }) => (
          <h3 className="text-xs font-semibold mb-1 mt-2 first:mt-0">
            {children}
          </h3>
        ),
        ul: ({ children }) => (
          <ul className="list-disc pl-4 mb-2 last:mb-0 space-y-0.5">
            {children}
          </ul>
        ),
        ol: ({ children }) => (
          <ol className="list-decimal pl-4 mb-2 last:mb-0 space-y-0.5">
            {children}
          </ol>
        ),
        li: ({ children }) => <li className="leading-relaxed">{children}</li>,
        code: ({ children, className }) => {
          const isBlock = className?.includes("language-");
          if (isBlock) {
            return (
              <code className="block bg-black/5 dark:bg-white/5 rounded px-2.5 py-2 text-[11px] leading-relaxed font-mono overflow-auto max-h-60 whitespace-pre">
                {children}
              </code>
            );
          }
          return (
            <code className="bg-black/5 dark:bg-white/8 rounded px-1 py-0.5 text-[11px] font-mono">
              {children}
            </code>
          );
        },
        pre: ({ children }) => (
          <pre className="mb-2 last:mb-0 overflow-auto rounded-md">
            {children}
          </pre>
        ),
        a: ({ href, children }) => (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary underline underline-offset-2 hover:opacity-80"
          >
            {children}
          </a>
        ),
        blockquote: ({ children }) => (
          <blockquote className="border-l-2 border-border pl-3 my-2 text-muted-foreground italic">
            {children}
          </blockquote>
        ),
        hr: () => <hr className="my-3 border-border/50" />,
        table: ({ children }) => (
          <div className="overflow-x-auto mb-2 last:mb-0">
            <table className="w-full text-[11px] border-collapse">
              {children}
            </table>
          </div>
        ),
        th: ({ children }) => (
          <th className="border border-border/50 px-2 py-1 text-left font-semibold bg-muted/50">
            {children}
          </th>
        ),
        td: ({ children }) => (
          <td className="border border-border/50 px-2 py-1.5 align-top">
            {children}
          </td>
        ),
        thead: ({ children }) => <thead>{children}</thead>,
        tbody: ({ children }) => <tbody>{children}</tbody>,
        tr: ({ children }) => <tr>{children}</tr>,
      }}
    >
      {content}
    </Markdown>
  );
}
