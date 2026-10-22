import { cn } from "cn"
import { useTheme } from "next-themes"
import { useHotkeys } from "react-hotkeys-hook"
import { toast } from "sonner"
import { ArrowLeftRight, Download } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { useCalibration, useDigitizer, useHistory } from "./store"
import { Stage } from "./components/Stage"
import { MiniChart } from "./components/MiniChart"
import { StepCard, StepNum } from "./components/StepCard"
import { SelTag } from "./components/SelTag"
import { PeakNotes } from "./components/PeakNotes"
import {
  DotLabel,
  NumField,
  TextField,
  Stat,
  PreviewRows,
} from "./components/primitives"
import { SAMPLE_MAX, SAMPLE_MIN } from "./lib/calibrate"
import { downloadCsv } from "./lib/export"
import { fmt } from "./lib/format"
import type { AxisScale, Row } from "./types"

function range(rows: Row[], i: 0 | 1) {
  let lo = Infinity
  let hi = -Infinity
  for (const r of rows) {
    if (r[i] < lo) lo = r[i]
    if (r[i] > hi) hi = r[i]
  }
  return `${fmt(lo)} – ${fmt(hi)}`
}

// ─── App ──────────────────────────────────────────────────────────────────────

export function App() {
  const d = useDigitizer()
  const { rows, peaks, issue, invalid, bends } = useCalibration()
  const { undo, redo } = useHistory()
  const { resolvedTheme, setTheme } = useTheme()

  const exportCsv = () => {
    if (!rows || !peaks) return
    const name = downloadCsv(
      rows,
      peaks,
      d.notes,
      d.xLabel,
      d.yLabel,
      d.fileName
    )
    toast.success(`Downloaded ${name}`)
  }

  useHotkeys("x", () => d.togglePickMode("xaxis"))
  useHotkeys("y", () => d.togglePickMode("yaxis"))
  useHotkeys("c", () => d.togglePickMode("curve"))
  useHotkeys("escape", () =>
    useDigitizer.setState({ pickMode: null, activePeak: null })
  )
  useHotkeys("mod+s", exportCsv, { preventDefault: true })
  useHotkeys("mod+z", () => undo(), { preventDefault: true })
  useHotkeys("mod+shift+z, mod+y", () => redo(), { preventDefault: true })
  useHotkeys("d", () => setTheme(resolvedTheme === "dark" ? "light" : "dark"))

  const status = !d.svg
    ? "No file loaded"
    : rows
      ? "Curve digitized"
      : "File loaded — pick your calibration lines"

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-6">
        {/* Header */}
        <header className="flex flex-wrap items-baseline justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold tracking-tight">
              Curve Digitizer
            </h1>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Turn a hand-traced SVG into calibrated (x, y) data — no
              plot-clicking, no library lock-in.
            </p>
          </div>
          <span
            className={cn(
              "inline-flex items-center rounded-full border px-3 py-1 text-xs",
              d.svg
                ? "border-primary/20 bg-primary/10 text-primary"
                : "border-border bg-muted text-muted-foreground"
            )}
          >
            {status}
          </span>
        </header>

        <div className="flex flex-wrap items-start gap-4 lg:flex-nowrap">
          <Stage bends={bends} />

          {/* Sidebar */}
          <aside className="flex w-full shrink-0 flex-col gap-3 lg:w-[360px]">
            <AxisStep axis="x" invalid={invalid} />
            <AxisStep axis="y" invalid={invalid} />

            {/* Step 3 — Curve */}
            <StepCard
              number={3}
              title="Pick the traced curve"
              done={!!d.sel.curve}
            >
              <p className="text-xs text-muted-foreground">
                Click the bezier path traced over the data. Must be a path, not
                a straight calibration line.
              </p>
              <Button
                size="sm"
                variant={d.pickMode === "curve" ? "default" : "outline"}
                disabled={!d.svg}
                onClick={() => d.togglePickMode("curve")}
                title="Shortcut: C"
              >
                {d.pickMode === "curve"
                  ? "Click the curve in the drawing…"
                  : "Pick curve path"}
              </Button>
              {d.sel.curve && (
                <SelTag color="amber">
                  <span className="font-mono text-muted-foreground">
                    {d.sel.curve.length.toFixed(1)} px
                  </span>
                </SelTag>
              )}
              <NumField
                label="Sample points"
                placeholder="500"
                value={d.sampleCount}
                min={SAMPLE_MIN}
                max={SAMPLE_MAX}
                onChange={(v) =>
                  useDigitizer.setState({ sampleCount: v ?? 500 })
                }
              />
              {d.sel.curve && <PeakNotes values={peaks} />}
            </StepCard>

            {/* Step 4 — Export */}
            <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4 shadow-sm">
              <div className="flex items-center gap-2">
                <StepNum done={!!rows}>4</StepNum>
                <h2 className="text-sm font-semibold">Export</h2>
              </div>

              {rows && rows.length > 0 && (
                <>
                  <div className="flex flex-wrap gap-4">
                    <Stat v={String(rows.length)} k="points" />
                    <Stat v={range(rows, 0)} k={d.xLabel || "x range"} />
                    <Stat v={range(rows, 1)} k={d.yLabel || "y range"} />
                  </div>
                  <MiniChart
                    rows={rows}
                    xLabel={d.xLabel}
                    yLabel={d.yLabel}
                    xScale={d.xScale}
                    yScale={d.yScale}
                  />
                  <table className="w-full border-collapse text-xs">
                    <thead>
                      <tr>
                        <th className="border-b border-border px-2 py-1 text-left font-medium text-muted-foreground">
                          {d.xLabel || "X"}
                        </th>
                        <th className="border-b border-border px-2 py-1 text-right font-medium text-muted-foreground">
                          {d.yLabel || "Y"}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      <PreviewRows rows={rows} />
                    </tbody>
                  </table>
                </>
              )}

              <Button
                disabled={!rows}
                onClick={exportCsv}
                className="w-full"
                title="Shortcut: Ctrl/⌘+S"
              >
                <Download />
                Export CSV
              </Button>

              {issue && <p className="text-xs text-destructive">{issue}</p>}
            </div>
          </aside>
        </div>

        <footer className="text-xs leading-relaxed text-muted-foreground">
          Works fully in your browser — nothing is uploaded anywhere. Scroll to
          zoom and drag to pan; zoom in if a click doesn&apos;t land on a thin
          line. Axis lines can be rotated or in a group with a transform —
          calibration is computed by projection onto each line&apos;s own
          direction, so that&apos;s fine. Shortcuts: X / Y / C pick, Esc cancel,
          Ctrl/⌘+Z undo, Ctrl/⌘+Shift+Z redo, + / − / 0 zoom, D theme.
        </footer>
      </div>
    </div>
  )
}

const AXIS = {
  x: {
    number: 1,
    mode: "xaxis",
    tag: "teal",
    dots: ["bg-teal-500", "bg-teal-700"],
    hint: (
      <>
        Click the straight line along the x-axis. First node = <b>start</b>,
        last = <b>end</b>.
      </>
    ),
    placeholders: ["0", "20"],
  },
  y: {
    number: 2,
    mode: "yaxis",
    tag: "orange",
    dots: ["bg-orange-500", "bg-orange-700"],
    hint: <>Same idea, along the y-axis.</>,
    placeholders: ["0", "6000"],
  },
} as const

function AxisStep({
  axis,
  invalid,
}: {
  axis: "x" | "y"
  invalid: ReadonlySet<string>
}) {
  const cfg = AXIS[axis]
  const upper = axis.toUpperCase()
  const keys = {
    start: `${axis}Start`,
    end: `${axis}End`,
    scale: `${axis}Scale`,
    label: `${axis}Label`,
  } as const
  const svg = useDigitizer((s) => s.svg)
  const picking = useDigitizer((s) => s.pickMode === cfg.mode)
  const selected = useDigitizer((s) => !!s.sel[cfg.mode])
  const start = useDigitizer((s) => s[keys.start])
  const end = useDigitizer((s) => s[keys.end])
  const scale = useDigitizer((s) => s[keys.scale])
  const label = useDigitizer((s) => s[keys.label])
  const togglePickMode = useDigitizer((s) => s.togglePickMode)
  const swap = useDigitizer((s) => s.swap)

  return (
    <StepCard
      number={cfg.number}
      title={`Calibrate ${upper} axis`}
      done={selected}
    >
      <p className="text-xs text-muted-foreground">{cfg.hint}</p>
      <Button
        size="sm"
        variant={picking ? "default" : "outline"}
        disabled={!svg}
        onClick={() => togglePickMode(cfg.mode)}
        title={`Shortcut: ${upper}`}
      >
        {picking ? "Click a line in the drawing…" : `Pick ${upper}-axis line`}
      </Button>
      {selected && (
        <SelTag color={cfg.tag}>
          <Button size="xs" variant="ghost" onClick={() => swap(axis)}>
            <ArrowLeftRight />
            swap
          </Button>
        </SelTag>
      )}
      <ToggleGroup
        variant="outline"
        size="sm"
        spacing={0}
        value={[scale]}
        onValueChange={(v) => {
          const next = v[0] as AxisScale | undefined
          if (next) useDigitizer.setState({ [keys.scale]: next })
        }}
      >
        <ToggleGroupItem value="linear">Linear</ToggleGroupItem>
        <ToggleGroupItem value="log">Log</ToggleGroupItem>
      </ToggleGroup>
      <div className="grid grid-cols-2 gap-2">
        <NumField
          label={<DotLabel color={cfg.dots[0]} text="value at start" />}
          placeholder={cfg.placeholders[0]}
          value={start}
          invalid={invalid.has(`${axis}.start`)}
          onChange={(v) => useDigitizer.setState({ [keys.start]: v })}
        />
        <NumField
          label={<DotLabel color={cfg.dots[1]} text="value at end" />}
          placeholder={cfg.placeholders[1]}
          value={end}
          invalid={invalid.has(`${axis}.end`)}
          onChange={(v) => useDigitizer.setState({ [keys.end]: v })}
        />
      </div>
      <TextField
        label="Column name"
        value={label}
        onChange={(v) => useDigitizer.setState({ [keys.label]: v })}
      />
    </StepCard>
  )
}

export default App
