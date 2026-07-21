import { Input } from "@/components/ui/input"
import { Search, Loader2 } from "lucide-react"

interface SearchBarProps {
  value: string
  onChange: (value: string) => void
  onSubmit: () => void
  isLoading?: boolean
}

export function SearchBar({ value, onChange, onSubmit, isLoading }: SearchBarProps) {
  return (
    <div className="relative w-full max-w-2xl mx-auto shadow-sm rounded-xl">
      <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none text-muted-foreground">
        {isLoading ? (
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
        ) : (
          <Search className="h-5 w-5" />
        )}
      </div>
      <Input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault()
            onSubmit()
          }
        }}
        placeholder="Ask anything about the knowledge base..."
        className="pl-12 pr-4 py-6 text-lg rounded-xl shadow-sm border-muted bg-card focus-visible:ring-primary h-14"
        disabled={isLoading}
        autoFocus
      />
    </div>
  )
}
