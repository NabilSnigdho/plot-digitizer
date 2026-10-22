import Papa from "papaparse"
import type { Row } from "../types"

// 8 significant digits keeps tiny log-axis values (e.g. 1.2e-9) intact.
const num = (v: number) => String(Number(v.toPrecision(8)))

// `peaks` are rows of `rows` (matched by identity); `notes` annotates them by
// peak index and fills the annotation column, which is blank elsewhere.
export function downloadCsv(
  rows: Row[],
  peaks: Row[],
  notes: Record<number, string>,
  xLabel: string,
  yLabel: string,
  fileName: string
) {
  const noteOf = new Map<Row, string>()
  peaks.forEach((row, k) => {
    const text = notes[k]?.trim()
    if (text) noteOf.set(row, text)
  })
  const csv = Papa.unparse({
    fields: [xLabel || "x", yLabel || "y", "annotation"],
    data: rows.map((row) => [num(row[0]), num(row[1]), noteOf.get(row) ?? ""]),
  })
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }))
  const a = document.createElement("a")
  a.href = url
  // Named after the source SVG, with a .csv extension.
  const name = `${fileName.replace(/\.svg$/i, "") || "digitized_curve"}.csv`
  a.download = name
  a.click()
  URL.revokeObjectURL(url)
  return name
}
