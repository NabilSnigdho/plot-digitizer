import { useCallback, useState } from "react"
import { C } from "../constants"
import { fmt } from "../lib/format"

export function MiniChart({ rows }: { rows: [number, number][] }) {
  const [hover, setHover] = useState<{
    x: number
    y: number
    px: number
    py: number
  } | null>(null)

  const W = 300
  const H = 120
  const PAD = 8

  const xs = rows.map((r) => r[0])
  const ys = rows.map((r) => r[1])
  const xMin = Math.min(...xs)
  const xMax = Math.max(...xs)
  const yMin = Math.min(...ys)
  const yMax = Math.max(...ys)
  const xSpan = xMax - xMin || 1
  const ySpan = yMax - yMin || 1
  const innerW = W - PAD * 2
  const innerH = H - PAD * 2

  const sx = (x: number) => PAD + ((x - xMin) / xSpan) * innerW
  const sy = (y: number) => H - PAD - ((y - yMin) / ySpan) * innerH

  const pts = rows
    .map((r) => `${sx(r[0]).toFixed(1)},${sy(r[1]).toFixed(1)}`)
    .join(" L ")
  const d = `M ${pts}`
  const areaD = `${d} L ${sx(xMax).toFixed(1)},${H - PAD} L ${sx(xMin).toFixed(1)},${H - PAD} Z`

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<SVGSVGElement>) => {
      const rect = e.currentTarget.getBoundingClientRect()
      const mx = ((e.clientX - rect.left) / rect.width) * W
      const xVal = xMin + ((mx - PAD) / innerW) * xSpan
      let lo = 0
      let hi = rows.length - 1
      while (lo < hi) {
        const mid = (lo + hi) >> 1
        if (rows[mid][0] < xVal) lo = mid + 1
        else hi = mid
      }
      const row = rows[lo]
      if (!row) return
      setHover({
        x: row[0],
        y: row[1],
        px: PAD + ((row[0] - xMin) / xSpan) * innerW,
        py: H - PAD - ((row[1] - yMin) / ySpan) * innerH,
      })
    },
    [rows, xMin, xSpan, yMin, ySpan, innerW, innerH]
  )

  return (
    <div className="relative">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        width="100%"
        height={H}
        preserveAspectRatio="none"
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setHover(null)}
        className="block"
      >
        <line
          x1={PAD}
          y1={H - PAD}
          x2={W - PAD}
          y2={H - PAD}
          stroke="currentColor"
          strokeOpacity={0.15}
          strokeWidth={1}
        />
        <path d={areaD} fill={C.curve} fillOpacity={0.12} stroke="none" />
        <path
          d={d}
          fill="none"
          stroke={C.curve}
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        {hover && (
          <>
            <line
              x1={hover.px}
              y1={PAD}
              x2={hover.px}
              y2={H - PAD}
              stroke="currentColor"
              strokeOpacity={0.3}
              strokeWidth={1}
            />
            <circle cx={hover.px} cy={hover.py} r={3} fill={C.curve} />
          </>
        )}
      </svg>
      {hover && (
        <div
          className="pointer-events-none absolute rounded bg-foreground px-2 py-0.5 font-mono text-xs text-background"
          style={{
            left: `${(hover.px / W) * 100}%`,
            top: `${(hover.py / H) * 100}%`,
            transform: "translate(-50%, -130%)",
          }}
        >
          {fmt(hover.x)}, {fmt(hover.y)}
        </div>
      )}
    </div>
  )
}
