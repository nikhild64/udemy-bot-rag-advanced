import { PlayCircle } from "lucide-react"

interface VideoThumbnailProps {
  courseId: string
  lessonId: string
  timestamp?: number
}

// In a real application, we might have an image service or YouTube ID mapping.
// For now, we simulate a clean, professional placeholder for the video thumbnail.
export function VideoThumbnail({ timestamp }: VideoThumbnailProps) {
  return (
    <div className="relative w-full aspect-video bg-muted/80 rounded-md overflow-hidden flex items-center justify-center border shadow-sm group">
      <PlayCircle className="w-10 h-10 text-muted-foreground/50 group-hover:text-primary transition-colors" />
      {timestamp !== undefined && (
        <div className="absolute bottom-2 right-2 bg-black/70 text-white text-[10px] px-1.5 py-0.5 rounded font-mono font-medium">
          {new Date(timestamp * 1000).toISOString().substr(14, 5)}
        </div>
      )}
    </div>
  )
}
