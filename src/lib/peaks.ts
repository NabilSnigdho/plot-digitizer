import type { Peak } from "../types"
import { toRoot } from "./svg"

// The path is sampled this finely to locate peaks before refining each one.
const PEAK_SAMPLES = 2000
// Bumps rising less than this fraction of the curve's height count as noise.
const MIN_PROMINENCE = 0.02
const REFINE_STEPS = 30

// How far a peak rises above the higher of the two valleys separating it from
// taller ground (or the curve's ends).
function prominence(h: number[], i: number): number {
  let left = h[i]
  for (let j = i - 1; j >= 0 && h[j] <= h[i]; j--) left = Math.min(left, h[j])
  let right = h[i]
  for (let j = i + 1; j < h.length && h[j] <= h[i]; j++)
    right = Math.min(right, h[j])
  return h[i] - Math.max(left, right)
}

// Finds the curve's peaks: local maxima toward the top of the drawing
// (smallest root y), in order along the path.
export function findPeaks(el: SVGPathElement, length: number): Peak[] {
  const at = (len: number) => toRoot(el, el.getPointAtLength(len))
  const n = PEAK_SAMPLES
  const lens = Array.from({ length: n }, (_, i) => (i / (n - 1)) * length)
  const h = lens.map((len) => -at(len).y)
  const lo = Math.min(...h)
  const hi = Math.max(...h)
  if (!(hi > lo)) return []
  const minProminence = (hi - lo) * MIN_PROMINENCE

  const peaks: Peak[] = []
  for (let i = 1; i < n - 1; i++) {
    if (!(h[i] > h[i - 1])) continue
    // walk across a flat top, if any
    let k = i
    while (k + 1 < n && h[k + 1] === h[i]) k++
    const m = (i + k) >> 1
    if (k + 1 < n && h[k + 1] < h[i] && prominence(h, m) >= minProminence) {
      // ternary search between the neighbouring samples for the exact top
      let a = lens[m - 1]
      let b = lens[m + 1]
      for (let s = 0; s < REFINE_STEPS; s++) {
        const m1 = a + (b - a) / 3
        const m2 = b - (b - a) / 3
        if (at(m1).y < at(m2).y) b = m2
        else a = m1
      }
      const len = (a + b) / 2
      peaks.push({ len, pt: at(len) })
    }
    i = k
  }
  return peaks
}
