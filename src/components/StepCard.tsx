import type { ReactNode } from "react"
import { cn } from "cn"

export function StepCard({
  number,
  title,
  done,
  children,
}: {
  number: number
  title: string
  done: boolean
  children: ReactNode
}) {
  return (
    <div
      className={cn(
        "rounded-xl border border-border bg-card p-4 shadow-sm",
        done && "border-primary/30"
      )}
    >
      <div className="mb-3 flex items-center gap-2">
        <StepNum done={done}>{number}</StepNum>
        <h2 className="text-sm font-semibold">{title}</h2>
      </div>
      <div className="flex flex-col gap-2">{children}</div>
    </div>
  )
}

export function StepNum({
  done,
  children,
}: {
  done: boolean
  children: ReactNode
}) {
  return (
    <span
      className={cn(
        "flex size-5 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
        done
          ? "bg-primary text-primary-foreground"
          : "bg-muted text-muted-foreground"
      )}
    >
      {children}
    </span>
  )
}
