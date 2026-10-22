export type PickMode = "xaxis" | "yaxis" | "curve" | null
export type SVGShape = SVGGraphicsElement & { __role?: string }

export interface Pt {
  x: number
  y: number
}

export interface AxisSel {
  el: SVGShape
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

export interface FormVals {
  xValStart: string
  xValEnd: string
  yValStart: string
  yValEnd: string
  sampleCount: string
}

export interface SelBools {
  xSel: boolean
  ySel: boolean
  curveSel: boolean
}
