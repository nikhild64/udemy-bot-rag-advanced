"use client"

import * as React from "react"
import { createPortal } from "react-dom"
import { cn } from "@/lib/utils"

interface DropdownMenuProps {
  trigger: React.ReactNode
  children: React.ReactNode
  align?: "left" | "right"
  className?: string
}

const DropdownMenuContext = React.createContext<{ closeMenu: () => void }>({ closeMenu: () => {} })

export function DropdownMenu({ trigger, children, align = "right", className }: DropdownMenuProps) {
  const [open, setOpen] = React.useState(false)
  const [mounted, setMounted] = React.useState(false)
  const [coords, setCoords] = React.useState<{ top: number; left?: number; right?: number }>({ top: 0 })
  const triggerRef = React.useRef<HTMLDivElement>(null)
  const menuRef = React.useRef<HTMLDivElement>(null)

  const closeMenu = React.useCallback(() => {
    setOpen(false)
  }, [])

  React.useEffect(() => {
    setMounted(true)
  }, [])

  const updatePosition = React.useCallback(() => {
    if (!triggerRef.current) return
    const rect = triggerRef.current.getBoundingClientRect()
    if (align === "right") {
      setCoords({
        top: rect.bottom + 6,
        right: Math.max(8, window.innerWidth - rect.right),
      })
    } else {
      setCoords({
        top: rect.bottom + 6,
        left: Math.max(8, rect.left),
      })
    }
  }, [align])

  const toggleOpen = (e: React.MouseEvent) => {
    e.stopPropagation()
    e.preventDefault()
    if (!open) {
      updatePosition()
    }
    setOpen((prev) => !prev)
  }

  React.useEffect(() => {
    if (!open) return

    function handleClickOutside(event: MouseEvent) {
      if (
        menuRef.current &&
        !menuRef.current.contains(event.target as Node) &&
        triggerRef.current &&
        !triggerRef.current.contains(event.target as Node)
      ) {
        setOpen(false)
      }
    }

    function handleScroll() {
      setOpen(false)
    }

    window.addEventListener("resize", updatePosition)
    document.addEventListener("scroll", handleScroll, true)
    document.addEventListener("mousedown", handleClickOutside)

    return () => {
      window.removeEventListener("resize", updatePosition)
      document.removeEventListener("scroll", handleScroll, true)
      document.removeEventListener("mousedown", handleClickOutside)
    }
  }, [open, updatePosition])

  const menuElement = open && mounted ? (
    createPortal(
      <DropdownMenuContext.Provider value={{ closeMenu }}>
        <div
          ref={menuRef}
          style={{
            position: "fixed",
            top: `${coords.top}px`,
            ...(coords.left !== undefined ? { left: `${coords.left}px` } : {}),
            ...(coords.right !== undefined ? { right: `${coords.right}px` } : {}),
          }}
          className={cn(
            "z-[99999] min-w-[11rem] overflow-hidden rounded-xl border border-border bg-card p-1.5 text-card-foreground shadow-2xl animate-in fade-in-80 zoom-in-95 backdrop-blur-xl",
            className
          )}
          onClick={(e) => {
            e.stopPropagation()
            setOpen(false)
          }}
        >
          {children}
        </div>
      </DropdownMenuContext.Provider>,
      document.body
    )
  ) : null

  return (
    <>
      <div ref={triggerRef} onClick={toggleOpen} className="inline-flex items-center cursor-pointer">
        {trigger}
      </div>
      {menuElement}
    </>
  )
}

export function DropdownMenuItem({
  className,
  children,
  onClick,
  destructive = false,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { destructive?: boolean }) {
  const { closeMenu } = React.useContext(DropdownMenuContext)

  return (
    <div
      className={cn(
        "relative flex cursor-pointer select-none items-center rounded-lg px-2.5 py-2 text-xs font-medium outline-none transition-colors hover:bg-muted hover:text-foreground",
        destructive && "text-destructive hover:bg-destructive/10 hover:text-destructive",
        className
      )}
      onClick={(e) => {
        closeMenu()
        onClick?.(e)
      }}
      {...props}
    >
      {children}
    </div>
  )
}
