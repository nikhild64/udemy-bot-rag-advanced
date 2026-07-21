import { Badge } from "@/components/ui/badge"

interface CitationProps {
  id: string
  onClick: () => void
  isActive?: boolean
}

export function Citation({ id, onClick, isActive }: CitationProps) {
  return (
    <Badge
      variant={isActive ? "default" : "secondary"}
      className="ml-1 cursor-pointer hover:bg-primary hover:text-primary-foreground transition-colors text-xs align-super -top-1 relative"
      onClick={onClick}
    >
      {id}
    </Badge>
  )
}
