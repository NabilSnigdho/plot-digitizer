export function fmt(v: number): string {
  const av = Math.abs(v)
  if (av !== 0 && (av < 0.001 || av >= 100_000)) return v.toExponential(2)
  return (Math.round(v * 1000) / 1000).toString()
}

export function csvCell(s: string): string {
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}
