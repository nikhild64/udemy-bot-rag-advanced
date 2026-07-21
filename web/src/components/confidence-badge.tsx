import { ShieldCheck, ShieldAlert, Shield } from "lucide-react"

interface ConfidenceBadgeProps {
  score?: number
}

export function ConfidenceBadge({ score }: ConfidenceBadgeProps) {
  if (score === undefined) return null

  // Using simple thresholds: > 0.8 is High, > 0.5 is Medium, else Low
  let label = "Low Confidence"
  let Icon = ShieldAlert
  let iconClass = "text-destructive"

  if (score >= 0.8) {
    label = "High Confidence"
    Icon = ShieldCheck
    iconClass = "text-emerald-500"
  } else if (score >= 0.5) {
    label = "Medium Confidence"
    Icon = Shield
    iconClass = "text-amber-500"
  }

  return (
    <div className="flex items-center gap-1.5 text-sm font-medium">
      <Icon className={`w-4 h-4 ${iconClass}`} />
      <span className="text-muted-foreground">{label}</span>
    </div>
  )
}
