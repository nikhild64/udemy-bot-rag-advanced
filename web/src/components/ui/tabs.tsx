"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

interface TabsContextType {
  value: string
  onValueChange: (value: string) => void
}

const TabsContext = React.createContext<TabsContextType | undefined>(undefined)

export function Tabs({
  value,
  defaultValue,
  onValueChange,
  children,
  className,
}: {
  value?: string
  defaultValue?: string
  onValueChange?: (val: string) => void
  children: React.ReactNode
  className?: string
}) {
  const [tabValue, setTabValue] = React.useState(value || defaultValue || "")

  const current = value !== undefined ? value : tabValue
  const handleValueChange = (val: string) => {
    if (value === undefined) setTabValue(val)
    onValueChange?.(val)
  }

  return (
    <TabsContext.Provider value={{ value: current, onValueChange: handleValueChange }}>
      <div className={cn("w-full", className)}>{children}</div>
    </TabsContext.Provider>
  )
}

export function TabsList({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <div
      className={cn(
        "inline-flex h-10 items-center justify-center rounded-md bg-muted p-1 text-muted-foreground",
        className
      )}
    >
      {children}
    </div>
  )
}

export function TabsTrigger({
  value,
  className,
  children,
}: {
  value: string
  className?: string
  children: React.ReactNode
}) {
  const ctx = React.useContext(TabsContext)
  const isSelected = ctx?.value === value

  return (
    <button
      type="button"
      className={cn(
        "inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50",
        isSelected
          ? "bg-background text-foreground shadow-xs"
          : "hover:bg-background/50 hover:text-foreground",
        className
      )}
      onClick={() => ctx?.onValueChange(value)}
    >
      {children}
    </button>
  )
}

export function TabsContent({
  value,
  className,
  children,
}: {
  value: string
  className?: string
  children: React.ReactNode
}) {
  const ctx = React.useContext(TabsContext)
  if (ctx?.value !== value) return null

  return <div className={cn("mt-2 ring-offset-background focus-visible:outline-none", className)}>{children}</div>
}
