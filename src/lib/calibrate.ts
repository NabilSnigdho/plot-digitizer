import { scaleLinear, scaleLog } from "d3-scale"
import { z } from "zod"
import type { AxisScale, Row, Sel } from "../types"
import { projectOntoLine, toRoot } from "./svg"

export const SAMPLE_MIN = 10
export const SAMPLE_MAX = 5000

export const AxisScaleSchema = z.enum(["linear", "log"])
export const SampleCountSchema = z
  .number()
  .int()
  .min(SAMPLE_MIN)
  .max(SAMPLE_MAX)

const MISSING = "Enter all four calibration values to compute the curve."
const value = z.number({ error: MISSING })

const axisSchema = (name: "X" | "Y") =>
  z
    .object({ start: value, end: value, scale: AxisScaleSchema })
    .superRefine((a, ctx) => {
      const flag = (message: string) => {
        for (const key of ["start", "end"] as const)
          ctx.addIssue({ code: "custom", message, path: [key] })
      }
      if (a.start === a.end) flag(`${name} start and end values must differ.`)
      else if (a.scale === "log" && (a.start <= 0 || a.end <= 0))
        flag(`A log ${name} axis needs positive calibration values.`)
    })

const CalibrationSchema = z.object({
  x: axisSchema("X"),
  y: axisSchema("Y"),
  sampleCount: z.number(),
})

type Axis = z.output<ReturnType<typeof axisSchema>>

interface AxisForm {
  start: number | null
  end: number | null
  scale: AxisScale
}

export interface CalibrationInput {
  sel: Sel
  x: AxisForm
  y: AxisForm
  sampleCount: number
}

export interface CalibrationResult {
  rows: Row[] | null
  // one row per curve peak (each also present in rows), in curve.peaks order
  peaks: Row[] | null
  issue: string
  // fields holding a bad (not just missing) value, e.g. "x.start"
  invalid: ReadonlySet<string>
}

// Maps a 0–1 position along the axis line back to a data value.
function axisInverse(a: Axis): (t: number) => number {
  const s =
    a.scale === "log"
      ? scaleLog().domain([a.start, a.end]).range([0, 1])
      : scaleLinear().domain([a.start, a.end]).range([0, 1])
  return (t) => s.invert(t)
}

export function calibrate({
  sel,
  ...form
}: CalibrationInput): CalibrationResult {
  const parsed = CalibrationSchema.safeParse(form)
  const issues = parsed.error?.issues ?? []
  const invalid = new Set(
    issues.filter((i) => i.code === "custom").map((i) => i.path.join("."))
  )

  const { xaxis, yaxis, curve } = sel
  if (!xaxis || !yaxis || !curve)
    return { rows: null, peaks: null, issue: "", invalid }
  if (!parsed.success)
    return {
      rows: null,
      peaks: null,
      issue: issues[0].message,
      invalid,
    }

  const { x, y, sampleCount } = parsed.data
  const n = Math.min(SAMPLE_MAX, Math.max(SAMPLE_MIN, Math.round(sampleCount)))
  const toX = axisInverse(x)
  const toY = axisInverse(y)

  const toData = (len: number): Row => {
    const p = toRoot(curve.el, curve.el.getPointAtLength(len))
    return [
      toX(projectOntoLine(p, xaxis.p0, xaxis.p1)),
      toY(projectOntoLine(p, yaxis.p0, yaxis.p1)),
    ]
  }

  const rows: Row[] = []
  for (let i = 0; i < n; i++) rows.push(toData((i / (n - 1)) * curve.length))

  // Each peak's exact point replaces its nearest sample so the data hits the
  // true maximum; peaks sharing a nearest sample are appended instead.
  const taken = new Set<number>()
  const peaks = curve.peaks.map(({ len }) => {
    const row = toData(len)
    const i = Math.round((len / curve.length) * (n - 1))
    if (taken.has(i)) rows.push(row)
    else {
      rows[i] = row
      taken.add(i)
    }
    return row
  })

  rows.sort((a, b) => a[0] - b[0])
  return { rows, peaks, issue: "", invalid }
}
