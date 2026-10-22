export type PickMode = "xaxis" | "yaxis" | "curve" | "annotate" | null
export type AxisScale = "linear" | "log"
export type Row = [number, number]

export interface Pt {
  x: number
  y: number
}

export interface AxisSel {
  el: SVGGraphicsElement
  p0: Pt
  p1: Pt
}

// A point on the curve: its arc length along the path and its position in
// root <svg> coordinates.
export interface PathPoint {
  len: number
  pt: Pt
}

// A local maximum of the curve.
export type Peak = PathPoint

// A note pinned to a point on the curve.
export interface Annotation extends PathPoint {
  id: number
  text: string
}

export interface CurveSel {
  el: SVGPathElement
  length: number
  peaks: Peak[]
  // points evenly spaced along the path, in root <svg> coordinates
  trace: Pt[]
  // the path's nodes (segment end points), in drawing order
  nodes: PathPoint[]
}

export interface Sel {
  xaxis: AxisSel | null
  yaxis: AxisSel | null
  curve: CurveSel | null
}
