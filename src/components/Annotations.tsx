import { useEffect, useRef } from "react"
import { cn } from "cn"
import { Crosshair, Mountain, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useDigitizer } from "../store"
import type { Row } from "../types"
import { fmt } from "../lib/format"
import { projectOntoLine } from "../lib/svg"

// Notes on points of the curve, listed by x. Points come from the curve's
// detected peaks or are picked by hand on the drawing; clicking a marker on
// the stage makes it active, which focuses its field here.
// `marked` holds each annotation's data row, in store order, once calibrated.
export function Annotations({ marked }: { marked: Row[] | null }) {
  const annotations = useDigitizer((s) => s.annotations)
  const active = useDigitizer((s) => s.activeNote)
  const peakCount = useDigitizer((s) => s.sel.curve?.peaks.length ?? 0)
  const xaxis = useDigitizer((s) => s.sel.xaxis)
  const picking = useDigitizer((s) => s.pickMode === "annotate")
  const { setNote, removeNote, addPeakNotes, togglePickMode } =
    useDigitizer.getState()
  const inputs = useRef(new Map<number, HTMLInputElement>())

  useEffect(() => {
    if (active === null) return
    const el = inputs.current.get(active)
    el?.focus({ preventScroll: true })
    el?.scrollIntoView({ block: "nearest" })
  }, [active])

  // data x once calibrated; until then, position along the x-axis line (or
  // across the drawing) keeps the same order
  const xOf = (k: number) => {
    const { pt } = annotations[k]
    if (marked) return marked[k][0]
    return xaxis ? projectOntoLine(pt, xaxis.p0, xaxis.p1) : pt.x
  }
  const order = annotations
    .map((a, k) => ({ a, k, x: xOf(k) }))
    .sort((p, q) => p.x - q.x)

  return (
    <div className="flex flex-col gap-2">
      <div className="grid grid-cols-2 gap-2">
        <Button
          size="sm"
          variant="outline"
          disabled={!peakCount}
          onClick={addPeakNotes}
          title={
            peakCount
              ? `Annotate the ${peakCount} detected ${peakCount === 1 ? "peak" : "peaks"}`
              : "No peaks found on this curve"
          }
        >
          <Mountain />
          Add peak points
        </Button>
        <Button
          size="sm"
          variant={picking ? "default" : "outline"}
          onClick={() => togglePickMode("annotate")}
          title="Pick any point on the curve (shortcut: A)"
        >
          <Crosshair />
          {picking ? "Click the curve…" : "Add manually"}
        </Button>
      </div>

      {order.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          No annotations yet — add the curve&apos;s peaks or pick points on it.
        </p>
      ) : (
        <>
          <span className="text-[11px] text-muted-foreground">
            {order.length} {order.length === 1 ? "annotation" : "annotations"} —
            click a marker or type to annotate
          </span>
          <div className="flex max-h-56 flex-col gap-1 overflow-y-auto p-1">
            {order.map(({ a, k }, i) => (
              <label
                key={a.id}
                className={cn(
                  "flex items-center gap-2 rounded-lg px-1 text-xs",
                  a.id === active && "bg-muted"
                )}
              >
                <span className="w-16 shrink-0 truncate font-mono text-muted-foreground tabular-nums">
                  {marked ? fmt(marked[k][0]) : `#${i + 1}`}
                </span>
                <Input
                  ref={(el) => {
                    if (el) inputs.current.set(a.id, el)
                    else inputs.current.delete(a.id)
                  }}
                  value={a.text}
                  placeholder={`Annotation ${i + 1}`}
                  onChange={(e) => setNote(a.id, e.target.value)}
                  onFocus={() => useDigitizer.setState({ activeNote: a.id })}
                  className="h-7"
                />
                <Button
                  size="icon-xs"
                  variant="ghost"
                  onClick={() => removeNote(a.id)}
                  title="Remove annotation"
                  aria-label="Remove annotation"
                >
                  <X />
                </Button>
              </label>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
