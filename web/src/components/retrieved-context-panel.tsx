import { RetrievedChunk } from "@/types/api"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Badge } from "@/components/ui/badge"

interface RetrievedContextPanelProps {
  chunks: RetrievedChunk[]
}

export function RetrievedContextPanel({ chunks }: RetrievedContextPanelProps) {
  if (chunks.length === 0) return null

  return (
    <div className="mt-8 border rounded-xl hidden overflow-hidden bg-card shadow-sm">
      <Accordion className="w-full">
        <AccordionItem value="context" className="border-b-0">
          <AccordionTrigger className="px-6 py-4 hover:no-underline hover:bg-muted/30">
            <div className="flex items-center gap-2 text-sm font-semibold">
              Retrieved Context
              <Badge variant="secondary" className="ml-2 font-mono text-xs">{chunks.length}</Badge>
            </div>
          </AccordionTrigger>
          <AccordionContent className="px-6 pb-6 pt-2">
            <div className="space-y-4">
              {chunks.map((chunk, index) => (
                <div key={chunk.chunkId || index} className="p-4 rounded-lg bg-muted/40 border">
                  <div className="flex justify-between items-start mb-2">
                    <div className="text-xs font-mono text-muted-foreground flex gap-3">
                      <span>Score: {chunk.score?.toFixed(4) || "N/A"}</span>
                      <span>ID: {chunk.chunkId}</span>
                    </div>
                  </div>
                  <div className="text-sm font-mono whitespace-pre-wrap break-words text-foreground/80">
                    {chunk.text}
                  </div>
                  {chunk.citation && (
                    <div className="mt-3 text-xs text-muted-foreground">
                      Source: {chunk.citation.lessonTitle} ({chunk.citation.courseName})
                    </div>
                  )}
                </div>
              ))}
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  )
}
