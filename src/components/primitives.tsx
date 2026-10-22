import type { ReactNode } from "react"
import { fmt } from "../lib/format"

export function NumInput({
  placeholder,
  value,
  onChange,
}: {
  placeholder?: string
  value: string
  onChange: (v: string) => void
}) {
  return (
    <input
      type="number"
      step="any"
      placeholder={placeholder}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="h-8 w-full rounded-md border border-input bg-background px-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
    />
  )
}

export function TxtInput({
  value,
  onChange,
}: {
  value: string
  onChange: (v: string) => void
}) {
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="h-8 w-full rounded-md border border-input bg-background px-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
    />
  )
}

export function FieldGroup({
  label,
  children,
}: {
  label: ReactNode
  children: ReactNode
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-[11px] text-muted-foreground">{label}</label>
      {children}
    </div>
  )
}

export function DotLabel({ color, text }: { color: string; text: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={`size-2 shrink-0 rounded-full ${color}`} />
      {text}
    </span>
  )
}

export function Stat({ v, k }: { v: string; k: string }) {
  return (
    <div className="flex flex-col">
      <span className="font-mono text-base tabular-nums">{v}</span>
      <span className="text-[10px] tracking-wider text-muted-foreground uppercase">
        {k}
      </span>
    </div>
  )
}

export function PreviewRows({ rows }: { rows: [number, number][] }) {
  const step = Math.max(1, Math.floor(rows.length / 6))
  return (
    <>
      {Array.from({ length: Math.ceil(rows.length / step) }, (_, i) => {
        const row = rows[i * step]
        return (
          <tr key={i} className="border-b border-border/50">
            <td className="px-2 py-0.5 font-mono tabular-nums">
              {fmt(row[0])}
            </td>
            <td className="px-2 py-0.5 text-right font-mono tabular-nums">
              {fmt(row[1])}
            </td>
          </tr>
        )
      })}
    </>
  )
}
