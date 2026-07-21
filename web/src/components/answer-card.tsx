import { Card, CardContent } from "@/components/ui/card"
import { MarkdownRenderer } from "./markdown-renderer"
import { RetrievedChunk } from "@/types/api"

interface AnswerCardProps {
  content: string
  onCitationClick?: (id: string) => void
  activeCitation?: string | null
  chunks?: RetrievedChunk[]
}

export function AnswerCard({ content, onCitationClick, activeCitation, chunks }: AnswerCardProps) {
  return (
    <Card className="border-muted shadow-sm overflow-hidden bg-card/50">
      <CardContent className="p-6">
        <MarkdownRenderer
          content={content}
          onCitationClick={onCitationClick}
          activeCitation={activeCitation}
          chunks={chunks}
        />
      </CardContent>
    </Card>
  )
}
