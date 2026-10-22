import type { CurveSel, PathPoint, Pt } from "../types"
import { toRoot } from "./svg"

const REFINE_STEPS = 30

// The point on the curve nearest to p (both in root <svg> coordinates) and
// its distance from p.
export function nearestOnCurve(
  curve: CurveSel,
  p: Pt
): PathPoint & { dist: number } {
  const { el, trace, length } = curve
  const d2 = (q: Pt) => (q.x - p.x) ** 2 + (q.y - p.y) ** 2
  let best = 0
  let bestD = Infinity
  trace.forEach((q, i) => {
    const d = d2(q)
    if (d < bestD) {
      bestD = d
      best = i
    }
  })

  // ternary search between the neighbouring trace points for the exact spot
  const at = (len: number) => toRoot(el, el.getPointAtLength(len))
  const step = length / (trace.length - 1)
  let a = Math.max(0, (best - 1) * step)
  let b = Math.min(length, (best + 1) * step)
  for (let s = 0; s < REFINE_STEPS; s++) {
    const m1 = a + (b - a) / 3
    const m2 = b - (b - a) / 3
    if (d2(at(m1)) < d2(at(m2))) b = m2
    else a = m1
  }
  const len = (a + b) / 2
  const pt = at(len)
  return { len, pt, dist: Math.sqrt(d2(pt)) }
}
