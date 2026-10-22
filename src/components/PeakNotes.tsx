import { useEffect, useRef } from "react"
import { cn } from "cn"
import { Input } from "@/components/ui/input"
import { useDigitizer } from "../store"
import type { Row } from "../types"
import { fmt } from "../lib/format"

// One annotation field per detected peak. Clicking a peak marker on the stage
// makes it active, which focuses its field here.
export function PeakNotes({ values }: { values: Row[] | null }) {
  const count = useDigitizer((s) => s.sel.curve?.peaks.length ?? 0)
  const notes = useDigitizer((s) => s.notes)
  const active = useDigitizer((s) => s.activePeak)
  const setNote = useDigitizer((s) => s.setNote)
  const inputs = useRef<(HTMLInputElement | null)[]>([])

  useEffect(() => {
    if (active === null) return
    const el = inputs.current[active]
    el?.focus({ preventScroll: true })
    el?.scrollIntoView({ block: "nearest" })
  }, [active])

  if (!count)
    return (
      <p className="text-xs text-muted-foreground">
        No peaks found on this curve.
      </p>
    )

  return (
    <div className="flex flex-col gap-1">
      <span className="text-[11px] text-muted-foreground">
        {count} {count === 1 ? "peak" : "peaks"} — click a marker or type to
        annotate
      </span>
      <div className="flex max-h-56 flex-col gap-1 overflow-y-auto p-1">
        {Array.from({ length: count }, (_, k) => (
          <label
            key={k}
            className={cn(
              "flex items-center gap-2 rounded-lg px-1 text-xs",
              k === active && "bg-muted"
            )}
          >
            <span className="w-16 shrink-0 truncate font-mono text-muted-foreground tabular-nums">
              {values ? fmt(values[k][0]) : `#${k + 1}`}
            </span>
            <Input
              ref={(el) => {
                inputs.current[k] = el
              }}
              value={notes[k] ?? ""}
              placeholder={`Peak ${k + 1}`}
              onChange={(e) => setNote(k, e.target.value)}
              onFocus={() => useDigitizer.setState({ activePeak: k })}
              className="h-7"
            />
          </label>
        ))}
      </div>
    </div>
  )
}
