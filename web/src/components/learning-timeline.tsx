import { RetrievedChunk } from "@/types/api"
import { TimelineCard } from "./timeline-card"
import { ScrollArea } from "@/components/ui/scroll-area"
import { useEffect, useRef } from "react"

interface LearningTimelineProps {
  chunks: RetrievedChunk[]
  activeCitation: string | null
  onCitationClick: (id: string) => void
}

export function LearningTimeline({ chunks, activeCitation, onCitationClick }: LearningTimelineProps) {
  const scrollAreaRef = useRef<HTMLDivElement>(null)

  // Sort chunks by course/module/lesson chronologically based on start time
  // Wait, if it's a timeline, maybe just present them in the order retrieved or sort by timestamp?
  // Let's sort them by courseName, moduleTitle, lessonTitle, startTime for a cohesive learning path.
  const sortedChunks = [...chunks].sort((a, b) => {
    if (a.citation.courseName !== b.citation.courseName) return a.citation.courseName.localeCompare(b.citation.courseName)
    if (a.citation.moduleTitle !== b.citation.moduleTitle) return a.citation.moduleTitle.localeCompare(b.citation.moduleTitle)
    if (a.citation.lessonTitle !== b.citation.lessonTitle) return a.citation.lessonTitle.localeCompare(b.citation.lessonTitle)
    return a.citation.startTime - b.citation.startTime
  })

  // Auto-scroll to active citation
  useEffect(() => {
    if (activeCitation) {
      const element = document.getElementById(`timeline-card-${activeCitation}`)
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }
    }
  }, [activeCitation])

  if (chunks.length === 0) {
    return null
  }

  return (
    <div className="flex flex-col h-full">
      <div className="mb-4">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          Learning Timeline
        </h3>
        <p className="text-sm text-muted-foreground mt-1">
          Chronological source attribution for this answer.
        </p>
      </div>
      
      <ScrollArea className="flex-1 -mx-4 px-4" ref={scrollAreaRef}>
        <div className="pb-8">
          {sortedChunks.map((chunk) => (
            <div key={chunk.chunkId} id={`timeline-card-${chunk.chunkId}`}>
              <TimelineCard 
                citation={chunk.citation} 
                isActive={activeCitation === chunk.chunkId}
                onClick={() => onCitationClick(chunk.chunkId)}
                textPreview={chunk.text}
              />
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  )
}
