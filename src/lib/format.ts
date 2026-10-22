const plain = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 3,
  useGrouping: false,
})
const scientific = new Intl.NumberFormat("en-US", {
  notation: "scientific",
  maximumFractionDigits: 2,
})

export function fmt(v: number): string {
  const av = Math.abs(v)
  if (av !== 0 && (av < 0.001 || av >= 100_000)) return scientific.format(v)
  return plain.format(v)
}
