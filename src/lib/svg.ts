import type { Pt, SVGShape } from "../types"
import { C } from "../constants"

export function getRawEndpoints(el: SVGShape): [Pt, Pt] {
  const tag = el.tagName.toLowerCase()
  if (tag === "line") {
    return [
      { x: +(el.getAttribute("x1") ?? 0), y: +(el.getAttribute("y1") ?? 0) },
      { x: +(el.getAttribute("x2") ?? 0), y: +(el.getAttribute("y2") ?? 0) },
    ]
  }
  if (tag === "polyline" || tag === "polygon") {
    const pts = (el as SVGPolylineElement).points
    if (!pts || pts.numberOfItems < 2)
      throw new Error("that shape has too few points")
    const a = pts.getItem(0)
    const b = pts.getItem(pts.numberOfItems - 1)
    return [
      { x: a.x, y: a.y },
      { x: b.x, y: b.y },
    ]
  }
  if (tag === "path") {
    const p = el as SVGPathElement
    const total = p.getTotalLength()
    if (!total) throw new Error("that path has zero length")
    const p0 = p.getPointAtLength(0)
    const p1 = p.getPointAtLength(total)
    return [
      { x: p0.x, y: p0.y },
      { x: p1.x, y: p1.y },
    ]
  }
  throw new Error("unsupported element type: " + tag)
}

export function projectOntoLine(p: Pt, a: Pt, b: Pt): number {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const denom = dx * dx + dy * dy
  if (denom === 0) return NaN
  return ((p.x - a.x) * dx + (p.y - a.y) * dy) / denom
}

export function svgViewWidth(svg: SVGSVGElement): number {
  const vb = svg.viewBox?.baseVal
  if (vb?.width) return vb.width
  try {
    return svg.getBBox().width || 500
  } catch {
    return 500
  }
}

export function resetShapeStyle(el: SVGShape) {
  delete el.__role
  el.style.stroke = C.neutral
  el.style.strokeOpacity = "0.55"
  el.style.strokeWidth = "2"
}
