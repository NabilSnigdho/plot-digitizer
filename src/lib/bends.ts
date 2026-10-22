import type { AxisSel, CurveSel, PathPoint, Pt } from "../types"
import { projectOntoLine, toRoot } from "./svg"

// The path is traced this finely to catch backward bends between samples.
const TRACE_SAMPLES = 5000
// Backward runs shorter than this fraction of the x-axis line count as noise.
const BACK_TOLERANCE = 1e-4

// Parameters per path command; the last two of each are its end point
// (h and v take a single coordinate).
const PARAMS: Record<string, number> = {
  m: 2,
  l: 2,
  h: 1,
  v: 1,
  c: 6,
  s: 4,
  q: 4,
  t: 2,
  a: 7,
  z: 0,
}

// The path's nodes — the end points of its segments, not their control
// handles — in the path's own coordinates and drawing order.
export function pathNodes(d: string): Pt[] {
  const nodes: Pt[] = []
  const num = /[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?/y
  let i = 0
  const skip = () => {
    while (i < d.length && /[\s,]/.test(d[i])) i++
  }
  const readNum = () => {
    skip()
    num.lastIndex = i
    const m = num.exec(d)
    if (!m) return null
    i = num.lastIndex
    return Number(m[0])
  }
  // arc flags may be written without separators, e.g. "a1 1 0 011 1"
  const readFlag = () => {
    skip()
    if (d[i] !== "0" && d[i] !== "1") return null
    return Number(d[i++])
  }

  let cmd = ""
  let cur: Pt = { x: 0, y: 0 }
  let start = cur
  for (;;) {
    skip()
    if (i >= d.length) break
    if (/[a-z]/i.test(d[i])) cmd = d[i++]
    const lc = cmd.toLowerCase()
    if (!(lc in PARAMS)) break
    if (lc === "z") {
      cur = start
      cmd = ""
      continue
    }
    const p: number[] = []
    for (let k = 0; k < PARAMS[lc]; k++) {
      const v = lc === "a" && (k === 3 || k === 4) ? readFlag() : readNum()
      if (v === null) return nodes
      p.push(v)
    }
    const rel = cmd === lc
    const ox = rel ? cur.x : 0
    const oy = rel ? cur.y : 0
    if (lc === "h") cur = { x: ox + p[0], y: cur.y }
    else if (lc === "v") cur = { x: cur.x, y: oy + p[0] }
    else cur = { x: ox + p[p.length - 2], y: oy + p[p.length - 1] }
    if (lc === "m") {
      start = cur
      // further coordinate pairs after a moveto are linetos
      cmd = rel ? "l" : "L"
    }
    nodes.push(cur)
  }
  return nodes
}

// Points evenly spaced along the path, in root <svg> coordinates.
export function traceCurve(el: SVGPathElement, length: number): Pt[] {
  const n = TRACE_SAMPLES
  return Array.from({ length: n }, (_, i) =>
    toRoot(el, el.getPointAtLength((i / (n - 1)) * length))
  )
}

// Places each node on the trace: its arc length is that of the nearest trace
// point at or after the previous node's.
export function locateNodes(
  el: SVGPathElement,
  trace: Pt[],
  length: number
): PathPoint[] {
  let from = 0
  return pathNodes(el.getAttribute("d") ?? "").map((p) => {
    const pt = toRoot(el, p)
    let best = from
    let bestDist = Infinity
    for (let i = from; i < trace.length; i++) {
      const dist = Math.hypot(trace[i].x - pt.x, trace[i].y - pt.y)
      if (dist < bestDist) {
        bestDist = dist
        best = i
      }
    }
    from = best
    return { len: (best / (trace.length - 1)) * length, pt }
  })
}

// Finds where the curve runs backwards along the x-axis (against its overall
// direction) and returns the nodes bracketing each such stretch — the ones
// whose handles bend it back.
export function findBends(curve: CurveSel, xaxis: AxisSel): Pt[] {
  const { trace, nodes, length } = curve
  const n = trace.length
  const t = trace.map((p) => projectOntoLine(p, xaxis.p0, xaxis.p1))
  const dir = Math.sign(t[n - 1] - t[0]) || 1
  const back = (i: number) => dir * (t[i] - t[i - 1]) < 0
  const toLen = (i: number) => (i / (n - 1)) * length

  const marked = new Set<PathPoint>()
  for (let i = 1; i < n; i++) {
    if (!back(i)) continue
    const s = i - 1
    while (i + 1 < n && back(i + 1)) i++
    if (dir * (t[s] - t[i]) < BACK_TOLERANCE) continue
    const a = toLen(s)
    const b = toLen(i)
    const lo = nodes.findLastIndex((nd) => nd.len <= a)
    const hi = nodes.findIndex((nd) => nd.len >= b)
    nodes
      .slice(Math.max(lo, 0), hi < 0 ? nodes.length : hi + 1)
      .forEach((nd) => marked.add(nd))
  }
  return [...marked].map((nd) => nd.pt)
}
