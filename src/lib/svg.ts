import DOMPurify from "dompurify"
import type { Pt, Sel } from "../types"
import { C } from "../constants"

const SVG_NS = "http://www.w3.org/2000/svg"
const MARKERS_ID = "__digitizer_markers"
export const SHAPE_CLASS = "dg-shape"

// Sanitizes untrusted SVG markup (scripts, on* handlers, javascript: URLs,
// foreignObject, …) and prepares it for the stage. Throws on unusable input.
export function prepareSvg(svgText: string): SVGSVGElement {
  const frag = DOMPurify.sanitize(svgText, {
    USE_PROFILES: { svg: true, svgFilters: true },
    RETURN_DOM_FRAGMENT: true,
  })
  const svg = frag.querySelector("svg")
  if (!svg) throw new Error("no <svg> element found")

  const shapes = svg.querySelectorAll("path, line, polyline, polygon")
  if (!shapes.length) throw new Error("no path/line/polyline elements found")
  shapes.forEach((el) => el.classList.add(SHAPE_CLASS))

  svg.style.width = "640px"
  svg.style.height = "auto"
  svg.removeAttribute("height")

  const markers = document.createElementNS(SVG_NS, "g")
  markers.setAttribute("id", MARKERS_ID)
  svg.appendChild(markers)
  return svg
}

export function getRawEndpoints(el: SVGGraphicsElement): [Pt, Pt] {
  if (el instanceof SVGLineElement) {
    return [
      { x: el.x1.baseVal.value, y: el.y1.baseVal.value },
      { x: el.x2.baseVal.value, y: el.y2.baseVal.value },
    ]
  }
  if (el instanceof SVGPolylineElement || el instanceof SVGPolygonElement) {
    const pts = el.points
    if (pts.numberOfItems < 2) throw new Error("that shape has too few points")
    const a = pts.getItem(0)
    const b = pts.getItem(pts.numberOfItems - 1)
    return [
      { x: a.x, y: a.y },
      { x: b.x, y: b.y },
    ]
  }
  if (el instanceof SVGPathElement) {
    const total = el.getTotalLength()
    if (!total) throw new Error("that path has zero length")
    const p0 = el.getPointAtLength(0)
    const p1 = el.getPointAtLength(total)
    return [
      { x: p0.x, y: p0.y },
      { x: p1.x, y: p1.y },
    ]
  }
  throw new Error("unsupported element type: " + el.tagName)
}

function rootSvg(el: SVGElement): SVGSVGElement | null {
  let svg = el.ownerSVGElement
  while (svg?.ownerSVGElement) svg = svg.ownerSVGElement
  return svg
}

// Maps a point from an element's local coordinates to the root <svg> user
// (viewBox) space. Going through screen CTMs cancels out the viewBox scaling,
// the rendered width and any pan/zoom transform on the stage.
export function toRoot(el: SVGGraphicsElement, pt: Pt): Pt {
  const local = el.getScreenCTM()
  const root = rootSvg(el)?.getScreenCTM()
  if (!local || !root) return pt
  const t = new DOMPoint(pt.x, pt.y).matrixTransform(
    root.inverse().multiply(local)
  )
  return { x: t.x, y: t.y }
}

export function projectOntoLine(p: Pt, a: Pt, b: Pt): number {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const denom = dx * dx + dy * dy
  if (denom === 0) return NaN
  return ((p.x - a.x) * dx + (p.y - a.y) * dy) / denom
}

function svgViewWidth(svg: SVGSVGElement): number {
  const vb = svg.viewBox?.baseVal
  if (vb?.width) return vb.width
  try {
    return svg.getBBox().width || 500
  } catch {
    return 500
  }
}

// Reflects the current selection on the drawing: role attributes (styled in
// index.css), endpoint markers on the calibration lines, and clickable peak
// markers (data-dg-peak = peak index) with their annotations, and rings
// around the curve nodes where it bends backwards.
export function renderSelection(
  svg: SVGSVGElement,
  sel: Sel,
  notes: Record<number, string>,
  activePeak: number | null,
  bends: Pt[]
) {
  svg
    .querySelectorAll("[data-dg-role]")
    .forEach((el) => el.removeAttribute("data-dg-role"))
  for (const role of ["xaxis", "yaxis", "curve"] as const) {
    sel[role]?.el.setAttribute("data-dg-role", role)
  }

  const ml = svg.querySelector(`#${MARKERS_ID}`)
  if (!ml) return
  ml.replaceChildren()
  const r = svgViewWidth(svg) / 130
  const addDot = (pt: Pt, color: string) => {
    const c = document.createElementNS(SVG_NS, "circle")
    c.setAttribute("cx", String(pt.x))
    c.setAttribute("cy", String(pt.y))
    c.setAttribute("r", String(r))
    c.setAttribute("fill", color)
    c.setAttribute("stroke", color)
    c.setAttribute("stroke-width", String(r * 0.35))
    c.style.pointerEvents = "none"
    ml.appendChild(c)
  }
  if (sel.xaxis) {
    addDot(sel.xaxis.p0, C.x)
    addDot(sel.xaxis.p1, C.x2)
  }
  if (sel.yaxis) {
    addDot(sel.yaxis.p0, C.y)
    addDot(sel.yaxis.p1, C.y2)
  }

  sel.curve?.peaks.forEach(({ pt }, k) => {
    const note = notes[k]?.trim()
    const active = k === activePeak
    const c = document.createElementNS(SVG_NS, "circle")
    c.setAttribute("data-dg-peak", String(k))
    c.setAttribute("cx", String(pt.x))
    c.setAttribute("cy", String(pt.y))
    c.setAttribute("r", String(active ? r * 1.3 : r))
    c.setAttribute("fill", note ? C.curve : "white")
    c.setAttribute("stroke", active ? C.hover : C.curve)
    c.setAttribute("stroke-width", String(r * 0.4))
    c.setAttribute("pointer-events", "all")
    const title = document.createElementNS(SVG_NS, "title")
    title.textContent = note || `Peak ${k + 1} — click to annotate`
    c.appendChild(title)
    ml.appendChild(c)
    if (!note) return

    const t = document.createElementNS(SVG_NS, "text")
    t.setAttribute("x", String(pt.x))
    t.setAttribute("y", String(pt.y - r * 2))
    t.setAttribute("text-anchor", "middle")
    t.setAttribute("font-family", "sans-serif")
    t.setAttribute("font-size", String(r * 2.6))
    t.setAttribute("fill", active ? C.hover : C.curve)
    t.setAttribute("stroke", "white")
    t.setAttribute("stroke-width", String(r * 0.6))
    t.setAttribute("paint-order", "stroke")
    t.style.pointerEvents = "none"
    t.textContent = note
    ml.appendChild(t)
  })

  for (const pt of bends) {
    const c = document.createElementNS(SVG_NS, "circle")
    c.setAttribute("cx", String(pt.x))
    c.setAttribute("cy", String(pt.y))
    c.setAttribute("r", String(r * 1.6))
    c.setAttribute("fill", "none")
    c.setAttribute("stroke", C.bend)
    c.setAttribute("stroke-width", String(r * 0.5))
    c.setAttribute("pointer-events", "all")
    const title = document.createElementNS(SVG_NS, "title")
    title.textContent = "The curve bends backwards along x near this node"
    c.appendChild(title)
    ml.appendChild(c)
  }
}
