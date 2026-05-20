"use client";

import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";

const components: Components = {
  p: ({ children }) => (
    <p className="my-2 first:mt-0 last:mb-0 leading-relaxed">{children}</p>
  ),
  h1: ({ children }) => (
    <h1 className="mt-3 mb-2 text-base font-semibold tracking-tight first:mt-0">
      {children}
    </h1>
  ),
  h2: ({ children }) => (
    <h2 className="mt-3 mb-2 text-sm font-semibold tracking-tight first:mt-0">
      {children}
    </h2>
  ),
  h3: ({ children }) => (
    <h3 className="mt-3 mb-1.5 text-sm font-semibold tracking-tight first:mt-0">
      {children}
    </h3>
  ),
  h4: ({ children }) => (
    <h4 className="mt-2 mb-1 text-sm font-semibold first:mt-0">{children}</h4>
  ),
  ul: ({ children }) => (
    <ul className="my-2 list-disc space-y-1 pl-5 first:mt-0 last:mb-0 marker:text-[var(--muted)]">
      {children}
    </ul>
  ),
  ol: ({ children }) => (
    <ol className="my-2 list-decimal space-y-1 pl-5 first:mt-0 last:mb-0 marker:text-[var(--muted)]">
      {children}
    </ol>
  ),
  li: ({ children }) => <li className="leading-relaxed">{children}</li>,
  blockquote: ({ children }) => (
    <blockquote className="my-2 border-l-2 border-[var(--accent)]/40 pl-3 italic text-[var(--muted)] first:mt-0 last:mb-0">
      {children}
    </blockquote>
  ),
  a: ({ href, children }) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer nofollow ugc"
      className="text-[var(--accent)] underline-offset-2 hover:underline"
    >
      {children}
    </a>
  ),
  strong: ({ children }) => (
    <strong className="font-semibold text-[var(--foreground)]">{children}</strong>
  ),
  em: ({ children }) => <em className="italic">{children}</em>,
  hr: () => <hr className="my-3 border-[var(--border)]" />,
  code: ({ className, children, ...rest }) => {
    const isBlock = "node" in rest && (rest.node as { tagName?: string } | undefined)?.tagName === "code"
      && /language-/.test(className ?? "");
    if (isBlock) {
      return (
        <code className={`${className ?? ""} font-mono text-[0.85em]`}>
          {children}
        </code>
      );
    }
    return (
      <code className="rounded bg-black/5 px-1 py-0.5 font-mono text-[0.85em] dark:bg-white/10">
        {children}
      </code>
    );
  },
  pre: ({ children }) => (
    <pre className="my-2 overflow-x-auto rounded-md border border-[var(--border)] bg-black/3 p-3 text-xs leading-relaxed first:mt-0 last:mb-0 dark:bg-white/5">
      {children}
    </pre>
  ),
  table: ({ children }) => (
    <div className="my-2 overflow-x-auto first:mt-0 last:mb-0">
      <table className="w-full border-collapse text-xs">{children}</table>
    </div>
  ),
  thead: ({ children }) => (
    <thead className="border-b border-[var(--border)] text-left">{children}</thead>
  ),
  th: ({ children }) => (
    <th className="px-2 py-1.5 font-semibold">{children}</th>
  ),
  td: ({ children }) => (
    <td className="border-b border-[var(--border)]/50 px-2 py-1.5 align-top">
      {children}
    </td>
  ),
};

export function MarkdownContent({ children }: { children: string }) {
  return (
    <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
      {children}
    </ReactMarkdown>
  );
}
