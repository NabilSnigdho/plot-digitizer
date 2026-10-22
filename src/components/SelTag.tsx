import type { ReactNode } from "react"
import { cn } from "cn"

export function SelTag({
  color,
  children,
}: {
  color: "teal" | "orange" | "amber"
  children: ReactNode
}) {
  const dot =
    color === "teal"
      ? "bg-teal-500"
      : color === "orange"
        ? "bg-orange-500"
        : "bg-amber-500"
  return (
    <div className="flex items-center justify-between rounded-lg bg-muted px-3 py-1.5 text-xs">
      <span className="flex items-center gap-1.5">
        <span className={cn("size-2 shrink-0 rounded-full", dot)} />
        {color === "amber" ? "curve" : "line"} selected
      </span>
      {children}
    </div>
  )
}
