export type PickMode = "xaxis" | "yaxis" | "curve" | null
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

export interface CurveSel {
  el: SVGPathElement
  length: number
}

export interface Sel {
  xaxis: AxisSel | null
  yaxis: AxisSel | null
  curve: CurveSel | null
}
