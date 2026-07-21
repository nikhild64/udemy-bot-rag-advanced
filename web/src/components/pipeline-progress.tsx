import { CheckCircle2, Circle, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"

interface PipelineProgressProps {
  stages: { id: string; label: string; status: 'pending' | 'active' | 'completed' }[]
}

export function PipelineProgress({ stages }: PipelineProgressProps) {
  return (
    <div className="flex flex-col gap-3 py-6 px-4">
      {stages.map((stage) => (
        <div key={stage.id} className="flex items-center gap-3">
          {stage.status === 'completed' && (
            <CheckCircle2 className="w-5 h-5 text-emerald-500" />
          )}
          {stage.status === 'active' && (
            <Loader2 className="w-5 h-5 text-primary animate-spin" />
          )}
          {stage.status === 'pending' && (
            <Circle className="w-5 h-5 text-muted-foreground/30" />
          )}
          <span 
            className={cn(
              "text-sm font-medium",
              stage.status === 'completed' ? "text-foreground" : 
              stage.status === 'active' ? "text-primary" : "text-muted-foreground"
            )}
          >
            {stage.label}
          </span>
        </div>
      ))}
    </div>
  )
}
