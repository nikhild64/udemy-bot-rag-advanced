import { useState } from "react"
import { ChevronDown, ChevronUp } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface TranscriptPreviewProps {
  text: string
  timestampStr?: string
}

export function TranscriptPreview({ text, timestampStr }: TranscriptPreviewProps) {
  const [isExpanded, setIsExpanded] = useState(false)

  return (
    <div className="mt-4 border rounded-lg bg-card overflow-hidden">
      <div 
        className="px-4 py-2 bg-muted/30 border-b text-xs font-medium text-muted-foreground flex justify-between items-center cursor-pointer hover:bg-muted/50 transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <span className="font-mono text-primary/80">{timestampStr || "Transcript"}</span>
        <Button variant="ghost" size="icon" className="h-6 w-6">
          {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </Button>
      </div>
      <div className={cn("px-4 py-3 text-sm text-muted-foreground font-sans leading-relaxed transition-all", !isExpanded && "line-clamp-3")}>
        {text}
      </div>
    </div>
  )
}
