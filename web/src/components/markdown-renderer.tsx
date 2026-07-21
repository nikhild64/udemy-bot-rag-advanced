import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import { Citation } from "./citation"
import { RetrievedChunk } from "@/types/api"

interface MarkdownRendererProps {
  content: string
  onCitationClick?: (id: string) => void
  activeCitation?: string | null
  chunks?: RetrievedChunk[]
}

// Pre-process to convert [12:45] or [1] to markdown links,
// and convert (Source X, ..., Timestamp: MM:SS → MM:SS) to make the timestamp clickable
function preprocessContent(content: string, chunks?: RetrievedChunk[]) {
  let processed = content.replace(/\[(\d+(?::\d+)*)\]/g, "[$1](cite://$1)")
  
  if (!chunks || chunks.length === 0) return processed

  // Matches (Source X, [anything], Timestamp: MM:SS → MM:SS)
  // Arrow can be → or ->
  const citationRegex = /\(Source (\d+), ([^)]*?)Timestamp: (\d+:\d+\s*[→\->]\s*\d+:\d+)\)/g

  processed = processed.replace(citationRegex, (match, sourceNum, middle, timestamp) => {
    const idx = parseInt(sourceNum, 10) - 1
    if (idx >= 0 && idx < chunks.length) {
      const chunkId = chunks[idx].chunkId
      return `(Source ${sourceNum}, ${middle}Timestamp: [${timestamp}](cite://${chunkId}))`
    }
    return match
  })

  return processed
}

export function MarkdownRenderer({
  content,
  onCitationClick,
  activeCitation,
  chunks,
}: MarkdownRendererProps) {
  const processedContent = preprocessContent(content, chunks)

  return (
    <div className="prose prose-neutral dark:prose-invert max-w-none text-foreground/90 font-sans">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        urlTransform={(url) => url}
        components={{
          a({ href, children, ...props }) {
            if (href?.startsWith("cite://")) {
              const id = href.replace("cite://", "")
              const isActive = activeCitation === id
              
              // If it's a numeric id (like legacy [1]), render superscript Citation badge
              const isNumeric = /^\d+$/.test(String(children))
              if (isNumeric) {
                return (
                  <Citation
                    id={String(children)}
                    isActive={isActive}
                    onClick={() => onCitationClick?.(id)}
                  />
                )
              }
              
              // Otherwise, render as inline clickable styled text (useful for timestamp links)
              return (
                <span
                  role="button"
                  onClick={() => onCitationClick?.(id)}
                  className={`cursor-pointer underline font-semibold transition-colors duration-200 ${
                    isActive 
                      ? 'text-primary bg-primary/10 rounded px-1' 
                      : 'text-primary hover:text-primary-strong'
                  }`}
                >
                  {children}
                </span>
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
