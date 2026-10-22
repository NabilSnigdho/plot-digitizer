import { scaleLinear, scaleLog } from "d3-scale"
import type { AxisScale, Row, Sel } from "../types"
import { projectOntoLine, toRoot } from "./svg"

export const SAMPLE_MIN = 10
export const SAMPLE_MAX = 5000

export interface AxisCalibration {
  start: number | null
  end: number | null
  scale: AxisScale
}

export interface CalibrationInput {
  sel: Sel
  x: AxisCalibration
  y: AxisCalibration
  sampleCount: number
}

export interface CalibrationResult {
  rows: Row[] | null
  issue: string
}

function axisIssue(name: string, a: AxisCalibration): string {
  if (a.start === null || a.end === null) return ""
  if (a.start === a.end) return `${name} start and end values must differ.`
  if (a.scale === "log" && (a.start <= 0 || a.end <= 0))
    return `A log ${name} axis needs positive calibration values.`
  return ""
}

// Maps a 0–1 position along the axis line back to a data value.
function axisInverse(a: AxisCalibration): (t: number) => number {
  const s =
    a.scale === "log"
      ? scaleLog().domain([a.start!, a.end!]).range([0, 1])
      : scaleLinear().domain([a.start!, a.end!]).range([0, 1])
  return (t) => s.invert(t)
}

export function calibrate({
  sel,
  x,
  y,
  sampleCount,
}: CalibrationInput): CalibrationResult {
  const { xaxis, yaxis, curve } = sel
  if (!xaxis || !yaxis || !curve) return { rows: null, issue: "" }

  if ([x.start, x.end, y.start, y.end].some((v) => v === null))
    return {
      rows: null,
      issue: "Enter all four calibration values to compute the curve.",
    }
  const issue = axisIssue("X", x) || axisIssue("Y", y)
  if (issue) return { rows: null, issue }

  const n = Math.min(SAMPLE_MAX, Math.max(SAMPLE_MIN, Math.round(sampleCount)))
  const toX = axisInverse(x)
  const toY = axisInverse(y)

  const rows: Row[] = []
  for (let i = 0; i < n; i++) {
    const local = curve.el.getPointAtLength((i / (n - 1)) * curve.length)
    const p = toRoot(curve.el, local)
    rows.push([
      toX(projectOntoLine(p, xaxis.p0, xaxis.p1)),
      toY(projectOntoLine(p, yaxis.p0, yaxis.p1)),
    ])
  }
  rows.sort((a, b) => a[0] - b[0])
  return { rows, issue: "" }
}
