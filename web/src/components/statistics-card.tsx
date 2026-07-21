import { Card, CardContent } from "@/components/ui/card"
import { Database, FileText, Timer, Target } from "lucide-react"

interface StatisticsCardProps {
  totalResults?: number
  elapsedTime?: number
  uniqueSources?: number
  highestScore?: number
}

export function StatisticsCard({ totalResults, elapsedTime, uniqueSources, highestScore }: StatisticsCardProps) {
  if (totalResults === undefined) return null

  return (
    <Card className="bg-muted/30 border-muted">
      <CardContent className="p-4 grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <Database className="w-3.5 h-3.5" />
            Sources
          </div>
          <div className="text-sm font-semibold">{totalResults} chunks</div>
        </div>

        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <FileText className="w-3.5 h-3.5" />
            Videos
          </div>
          <div className="text-sm font-semibold">{uniqueSources || '-'} references</div>
        </div>

        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <Target className="w-3.5 h-3.5" />
            Similarity
          </div>
          <div className="text-sm font-semibold">{highestScore !== undefined ? highestScore.toFixed(2) : '-'} peak</div>
        </div>

        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <Timer className="w-3.5 h-3.5" />
            Latency
          </div>
          <div className="text-sm font-semibold">{elapsedTime !== undefined ? `${(elapsedTime / 1000).toFixed(2)}s` : '-'}</div>
        </div>
      </CardContent>
    </Card>
  )
}
