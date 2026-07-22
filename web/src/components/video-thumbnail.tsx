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
      <img 
        src="/video-placeholder.png" 
        alt="Video thumbnail" 
        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
      />
      <div className="absolute inset-0 bg-black/20 group-hover:bg-black/10 transition-colors flex items-center justify-center">
        <PlayCircle className="w-10 h-10 text-white/90 drop-shadow-md group-hover:text-white group-hover:scale-110 transition-all" />
      </div>
      {timestamp !== undefined && (
        <div className="absolute bottom-2 right-2 bg-black/80 text-white text-[10px] px-1.5 py-0.5 rounded font-mono font-medium border border-white/10 shadow-sm">
          {new Date(timestamp * 1000).toISOString().substr(14, 5)}
        </div>
      )}
    </div>
  )
}
