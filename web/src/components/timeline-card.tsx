import { Citation } from "@/types/api"
import { VideoThumbnail } from "./video-thumbnail"
import { TranscriptPreview } from "./transcript-preview"
import { Button } from "@/components/ui/button"
import { ExternalLink, CheckCircle2 } from "lucide-react"
import { cn } from "@/lib/utils"

interface TimelineCardProps {
  citation: Citation
  isActive?: boolean
  onClick?: () => void
  textPreview: string
}

function formatTime(seconds: number): string {
  const date = new Date(seconds * 1000)
  return date.toISOString().substr(11, 8).replace(/^00:/, '')
}

export function TimelineCard({ citation, isActive, onClick, textPreview }: TimelineCardProps) {
  const handleOpenVideo = (e: React.MouseEvent) => {
    e.stopPropagation()
    // Simulated video open action. In a real application, you'd link to the actual provider.
    window.open(`https://example.com/video/${citation.lessonId}?t=${citation.startTime}s`, '_blank')
  }

  return (
    <div 
      className={cn(
        "relative pl-6 py-4 border-l-2 cursor-pointer transition-all",
        isActive ? "border-primary" : "border-muted hover:border-primary/50"
      )}
      onClick={onClick}
    >
      <div className={cn(
        "absolute -left-[11px] top-5 bg-background rounded-full p-0.5",
        isActive ? "text-primary" : "text-muted-foreground"
      )}>
        <CheckCircle2 className="w-4 h-4 fill-current text-background" />
      </div>

      <div className={cn(
        "rounded-xl border p-4 bg-card shadow-sm transition-all",
        isActive && "ring-2 ring-primary/20 border-primary/30"
      )}>
        <div className="flex items-start gap-4 mb-4">
          <div className="w-1/3 flex-shrink-0">
            <VideoThumbnail 
              courseId={citation.courseId} 
              lessonId={citation.lessonId} 
              timestamp={citation.startTime} 
            />
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="font-semibold text-sm truncate">{citation.lessonTitle}</h4>
            <p className="text-xs text-muted-foreground truncate mt-1">{citation.courseName}</p>
            <p className="text-xs text-muted-foreground truncate">{citation.moduleTitle}</p>
            {/* Hiding Open Video button temporarily per user request */}
            {/* <div className="mt-3">
              <Button 
                variant={isActive ? "default" : "secondary"}
                size="sm" 
                className="h-7 text-xs"
                onClick={handleOpenVideo}
              >
                <ExternalLink className="w-3 h-3 mr-1.5" />
                Open Video
              </Button>
            </div> */}
          </div>
        </div>

        <TranscriptPreview 
          text={textPreview} 
          timestampStr={`${formatTime(citation.startTime)} - ${formatTime(citation.endTime)}`}
        />
      </div>
    </div>
  )
}
