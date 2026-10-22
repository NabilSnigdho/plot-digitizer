import { scaleLinear, scaleLog } from "d3-scale"
import { z } from "zod"
import type { AxisScale, Pt, Row, Sel } from "../types"
import { projectOntoLine, toRoot } from "./svg"
import { findBends } from "./bends"

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
  // arc lengths of points the output must include exactly (annotations)
  marks: number[]
}

export interface CalibrationResult {
  rows: Row[] | null
  // one row per mark (each also present in rows), in marks order
  marked: Row[] | null
  issue: string
  // fields holding a bad (not just missing) value, e.g. "x.start"
  invalid: ReadonlySet<string>
  // curve nodes where the path bends backwards along x; any blocks output
  bends: Pt[]
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
  marks,
  ...form
}: CalibrationInput): CalibrationResult {
  const parsed = CalibrationSchema.safeParse(form)
  const issues = parsed.error?.issues ?? []
  const invalid = new Set(
    issues.filter((i) => i.code === "custom").map((i) => i.path.join("."))
  )

  const { xaxis, yaxis, curve } = sel
  // Data must be a function of x: a curve that runs back along the x-axis
  // would give interleaved rows, so it is refused until the drawing is fixed.
  const bends = xaxis && curve ? findBends(curve, xaxis) : []
  const blocked = (issue: string): CalibrationResult => ({
    rows: null,
    marked: null,
    issue,
    invalid,
    bends,
  })
  if (bends.length)
    return blocked(
      `The curve bends backwards along the x-axis. Adjust the handles of the ${bends.length} node${bends.length === 1 ? "" : "s"} circled in red so x only moves forward, then re-upload.`
    )
  if (!xaxis || !yaxis || !curve) return blocked("")
  if (!parsed.success) return blocked(issues[0].message)

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

  const samples: { len: number; row: Row }[] = []
  for (let i = 0; i < n; i++) {
    const len = (i / (n - 1)) * curve.length
    samples.push({ len, row: toData(len) })
  }

  // Each mark's exact point replaces its nearest sample so the data hits it
  // (e.g. a peak's true maximum); marks sharing a nearest sample are added
  // alongside it.
  const taken = new Set<number>()
  const marked = marks.map((len) => {
    const row = toData(len)
    const i = Math.round((len / curve.length) * (n - 1))
    if (taken.has(i)) samples.push({ len, row })
    else {
      samples[i] = { len, row }
      taken.add(i)
    }
    return row
  })

  // Keep path order; with no backward bends it is also x order.
  samples.sort((a, b) => a.len - b.len)
  const rows = samples.map((s) => s.row)
  if (rows.length > 1 && rows[0][0] > rows[rows.length - 1][0]) rows.reverse()
  return { rows, marked, issue: "", invalid, bends }
}
