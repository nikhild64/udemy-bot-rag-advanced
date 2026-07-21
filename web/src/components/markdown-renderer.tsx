import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import { Citation } from "./citation"

interface MarkdownRendererProps {
  content: string
  onCitationClick?: (id: string) => void
  activeCitation?: string | null
}

// Pre-process to convert [12:45] or [1] to markdown links [12:45](cite://12:45)
function preprocessContent(content: string) {
  // Matches [12:45] or [1] or [12:34:56]
  return content.replace(/\[(\d+(?::\d+)*)\]/g, "[$1](cite://$1)")
}

export function MarkdownRenderer({
  content,
  onCitationClick,
  activeCitation,
}: MarkdownRendererProps) {
  const processedContent = preprocessContent(content)

  return (
    <div className="prose prose-neutral dark:prose-invert max-w-none text-foreground/90 font-sans">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a({ href, children, ...props }) {
            if (href?.startsWith("cite://")) {
              const id = href.replace("cite://", "")
              return (
                <Citation
                  id={id}
                  isActive={activeCitation === id}
                  onClick={() => onCitationClick?.(id)}
                />
              )
            }
            return (
              <a href={href} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline" {...props}>
                {children}
              </a>
            )
          },
          table({ children, ...props }) {
            return (
              <div className="overflow-x-auto my-4 border rounded-lg">
                <table className="min-w-full text-sm divide-y" {...props}>
                  {children}
                </table>
              </div>
            )
          },
          th({ children, ...props }) {
            return (
              <th className="px-4 py-3 bg-muted/50 font-medium text-left" {...props}>
                {children}
              </th>
            )
          },
          td({ children, ...props }) {
            return (
              <td className="px-4 py-3 border-t" {...props}>
                {children}
              </td>
            )
          },
          pre({ children, ...props }) {
            return (
              <div className="rounded-lg border bg-muted/50 p-4 overflow-x-auto my-4">
                <pre className="font-mono text-sm" {...props}>
                  {children}
                </pre>
              </div>
            )
          },
          code({ children, className, ...props }: React.ComponentPropsWithoutRef<"code">) {
            // In react-markdown v9+, inline prop is removed. 
            // Code blocks are passed to pre > code. Inline code is passed to code.
            // But if we want to ensure we don't render a block inside a p, we just return a code tag here.
            // The pre mapping handles the block container.
            const isBlock = className?.includes("language-")
            return (
              <code 
                className={isBlock ? "font-mono text-sm" : "bg-muted px-1.5 py-0.5 rounded-md font-mono text-sm"} 
                {...props}
              >
                {children}
              </code>
            )
          },
        }}
      >
        {processedContent}
      </ReactMarkdown>
    </div>
  )
}
