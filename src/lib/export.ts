import Papa from "papaparse"
import type { Row } from "../types"

// 8 significant digits keeps tiny log-axis values (e.g. 1.2e-9) intact.
const num = (v: number) => String(Number(v.toPrecision(8)))

export function downloadCsv(rows: Row[], xLabel: string, yLabel: string) {
  const csv = Papa.unparse({
    fields: [xLabel || "x", yLabel || "y"],
    data: rows.map(([x, y]) => [num(x), num(y)]),
  })
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }))
  const a = document.createElement("a")
  a.href = url
  a.download = "digitized_curve.csv"
  a.click()
  URL.revokeObjectURL(url)
}
