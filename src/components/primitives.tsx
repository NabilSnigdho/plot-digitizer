import { useId, type ReactNode } from "react"
import { NumberField } from "@base-ui/react/number-field"
import { Minus, Plus } from "lucide-react"
import { Field, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import type { Row } from "../types"
import { fmt } from "../lib/format"

export function NumField({
  label,
  placeholder,
  value,
  onChange,
  min,
  max,
  invalid,
}: {
  label: ReactNode
  placeholder?: string
  value: number | null
  onChange: (v: number | null) => void
  min?: number
  max?: number
  invalid?: boolean
}) {
  const id = useId()
  return (
    <Field data-invalid={invalid || undefined} className="gap-1">
      <FieldLabel htmlFor={id} className="text-[11px] font-normal">
        {label}
      </FieldLabel>
      <NumberField.Root
        id={id}
        value={value}
        onValueChange={onChange}
        min={min}
        max={max}
        step="any"
        format={{ maximumFractionDigits: 12, useGrouping: false }}
      >
        <NumberField.Group className="flex h-8 items-center rounded-3xl bg-input/50 focus-within:ring-3 focus-within:ring-ring/30 has-aria-invalid:ring-3 has-aria-invalid:ring-destructive/20">
          <NumberField.Decrement className="flex size-8 shrink-0 items-center justify-center text-muted-foreground hover:text-foreground">
            <Minus className="size-3" />
          </NumberField.Decrement>
          <NumberField.Input
            placeholder={placeholder}
            aria-invalid={invalid || undefined}
            className="h-full w-full min-w-0 bg-transparent text-center text-sm tabular-nums outline-none placeholder:text-muted-foreground"
          />
          <NumberField.Increment className="flex size-8 shrink-0 items-center justify-center text-muted-foreground hover:text-foreground">
            <Plus className="size-3" />
          </NumberField.Increment>
        </NumberField.Group>
      </NumberField.Root>
    </Field>
  )
}

export function TextField({
  label,
  value,
  onChange,
}: {
  label: ReactNode
  value: string
  onChange: (v: string) => void
}) {
  const id = useId()
  return (
    <Field className="gap-1">
      <FieldLabel htmlFor={id} className="text-[11px] font-normal">
        {label}
      </FieldLabel>
      <Input
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-8"
      />
    </Field>
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

export function PreviewRows({ rows }: { rows: Row[] }) {
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
