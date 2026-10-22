import { cn } from "cn"
import {
  ArrowLeftRight,
  Download,
  Maximize2,
  TrendingUp,
  Upload,
  ZoomIn,
  ZoomOut,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { useDigitizer } from "./hooks/useDigitizer"
import { MiniChart } from "./components/MiniChart"
import { StepCard, StepNum } from "./components/StepCard"
import { SelTag } from "./components/SelTag"
import {
  FieldGroup,
  DotLabel,
  NumInput,
  TxtInput,
  Stat,
  PreviewRows,
} from "./components/primitives"
import { fmt } from "./lib/format"

// ─── App ──────────────────────────────────────────────────────────────────────

export function App() {
  const { setFileInputRef, setStageRef, ...d } = useDigitizer()

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
              d.svgLoaded
                ? "border-primary/20 bg-primary/10 text-primary"
                : "border-border bg-muted text-muted-foreground"
            )}
          >
            {d.globalStatus}
          </span>
        </header>

        <div className="flex flex-wrap items-start gap-4 lg:flex-nowrap">
          {/* Canvas */}
          <section className="min-w-0 flex-1 overflow-hidden rounded-xl border border-border bg-card shadow-sm">
            <div className="flex flex-wrap items-center gap-2 border-b border-border px-3 py-2">
              <Button size="sm" variant="outline" onClick={d.openFilePicker}>
                <Upload />
                Upload SVG
              </Button>
              <input
                ref={setFileInputRef}
                type="file"
                accept=".svg,image/svg+xml"
                hidden
                onChange={(e) => {
                  const f = e.target.files?.[0]
                  if (f) d.loadFile(f)
                }}
              />
              {d.fileName && (
                <span className="max-w-[200px] truncate text-xs text-muted-foreground">
                  {d.fileName}
                </span>
              )}
              <div className="flex-1" />
              <Button
                size="icon-sm"
                variant="ghost"
                disabled={!d.svgLoaded}
                onClick={() => d.setZoom((z) => Math.max(0.25, z / 1.4))}
              >
                <ZoomOut />
              </Button>
              <span className="w-12 text-center text-xs text-muted-foreground tabular-nums">
                {Math.round(d.zoom * 100)}%
              </span>
              <Button
                size="icon-sm"
                variant="ghost"
                disabled={!d.svgLoaded}
                onClick={() => d.setZoom((z) => Math.min(6, z * 1.4))}
              >
                <ZoomIn />
              </Button>
              <Button
                size="icon-sm"
                variant="ghost"
                disabled={!d.svgLoaded}
                onClick={() => d.setZoom(() => 1)}
              >
                <Maximize2 />
              </Button>
            </div>

            {/* Stage */}
            <div
              className={cn(
                "relative overflow-auto bg-muted/40",
                d.dragOver && "ring-2 ring-primary ring-inset"
              )}
              style={{
                height: "min(62vh, 620px)",
                backgroundImage:
                  "linear-gradient(45deg,oklch(0.85 0 0 / .4) 25%,transparent 25%)," +
                  "linear-gradient(-45deg,oklch(0.85 0 0 / .4) 25%,transparent 25%)," +
                  "linear-gradient(45deg,transparent 75%,oklch(0.85 0 0 / .4) 75%)," +
                  "linear-gradient(-45deg,transparent 75%,oklch(0.85 0 0 / .4) 75%)",
                backgroundSize: "20px 20px",
                backgroundPosition: "0 0, 0 10px, 10px -10px, -10px 0px",
              }}
              onDragOver={(e) => {
                e.preventDefault()
                d.setDragOver(true)
              }}
              onDragLeave={() => d.setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault()
                d.setDragOver(false)
                const f = e.dataTransfer.files?.[0]
                if (f) d.loadFile(f)
              }}
            >
              <div className="inline-block min-h-full min-w-full p-6">
                <div ref={setStageRef} />
              </div>
              {!d.svgLoaded && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center text-sm text-muted-foreground">
                  <div className="flex size-12 items-center justify-center rounded-xl bg-muted">
                    <TrendingUp className="size-6" />
                  </div>
                  <div>
                    Upload the SVG you traced in Inkscape
                    <br />
                    (axis lines + curve path) to begin.
                    <br />
                    <span className="text-xs opacity-60">
                      Or drag-and-drop here.
                    </span>
                  </div>
                </div>
              )}
            </div>
          </section>

          {/* Sidebar */}
          <aside className="flex w-full shrink-0 flex-col gap-3 lg:w-[360px]">
            {/* Step 1 — X axis */}
            <StepCard number={1} title="Calibrate X axis" done={d.xSel}>
              <p className="text-xs text-muted-foreground">
                Click the straight line along the x-axis. First node ={" "}
                <b>start</b>, last = <b>end</b>.
              </p>
              <Button
                size="sm"
                variant={d.pickMode === "xaxis" ? "default" : "outline"}
                disabled={!d.svgLoaded}
                onClick={() =>
                  d.setPickMode((m) => (m === "xaxis" ? null : "xaxis"))
                }
              >
                {d.pickMode === "xaxis"
                  ? "Click a line in the drawing…"
                  : "Pick X-axis line"}
              </Button>
              {d.xSel && (
                <SelTag color="teal">
                  <Button size="xs" variant="ghost" onClick={d.swapX}>
                    <ArrowLeftRight />
                    swap
                  </Button>
                </SelTag>
              )}
              <div className="grid grid-cols-2 gap-2">
                <FieldGroup
                  label={<DotLabel color="bg-teal-500" text="value at start" />}
                >
                  <NumInput
                    placeholder="0"
                    value={d.xValStart}
                    onChange={d.handleXValStart}
                  />
                </FieldGroup>
                <FieldGroup
                  label={<DotLabel color="bg-teal-700" text="value at end" />}
                >
                  <NumInput
                    placeholder="20"
                    value={d.xValEnd}
                    onChange={d.handleXValEnd}
                  />
                </FieldGroup>
              </div>
              <FieldGroup label="Column name">
                <TxtInput value={d.xLabel} onChange={d.setXLabel} />
              </FieldGroup>
            </StepCard>

            {/* Step 2 — Y axis */}
            <StepCard number={2} title="Calibrate Y axis" done={d.ySel}>
              <p className="text-xs text-muted-foreground">
                Same idea, along the y-axis.
              </p>
              <Button
                size="sm"
                variant={d.pickMode === "yaxis" ? "default" : "outline"}
                disabled={!d.svgLoaded}
                onClick={() =>
                  d.setPickMode((m) => (m === "yaxis" ? null : "yaxis"))
                }
              >
                {d.pickMode === "yaxis"
                  ? "Click a line in the drawing…"
                  : "Pick Y-axis line"}
              </Button>
              {d.ySel && (
                <SelTag color="orange">
                  <Button size="xs" variant="ghost" onClick={d.swapY}>
                    <ArrowLeftRight />
                    swap
                  </Button>
                </SelTag>
              )}
              <div className="grid grid-cols-2 gap-2">
                <FieldGroup
                  label={
                    <DotLabel color="bg-orange-500" text="value at start" />
                  }
                >
                  <NumInput
                    placeholder="0"
                    value={d.yValStart}
                    onChange={d.handleYValStart}
                  />
                </FieldGroup>
                <FieldGroup
                  label={<DotLabel color="bg-orange-700" text="value at end" />}
                >
                  <NumInput
                    placeholder="6000"
                    value={d.yValEnd}
                    onChange={d.handleYValEnd}
                  />
                </FieldGroup>
              </div>
              <FieldGroup label="Column name">
                <TxtInput value={d.yLabel} onChange={d.setYLabel} />
              </FieldGroup>
            </StepCard>

            {/* Step 3 — Curve */}
            <StepCard
              number={3}
              title="Pick the traced curve"
              done={d.curveSel}
            >
              <p className="text-xs text-muted-foreground">
                Click the bezier path traced over the data. Must be a path, not
                a straight calibration line.
              </p>
              <Button
                size="sm"
                variant={d.pickMode === "curve" ? "default" : "outline"}
                disabled={!d.svgLoaded}
                onClick={() =>
                  d.setPickMode((m) => (m === "curve" ? null : "curve"))
                }
              >
                {d.pickMode === "curve"
                  ? "Click the curve in the drawing…"
                  : "Pick curve path"}
              </Button>
              {d.curveSel && (
                <SelTag color="amber">
                  <span className="font-mono text-muted-foreground">
                    {d.curveLen}
                  </span>
                </SelTag>
              )}
              <FieldGroup label="Sample points">
                <NumInput
                  placeholder="500"
                  value={d.sampleCount}
                  onChange={d.handleSampleCount}
                />
              </FieldGroup>
            </StepCard>

            {/* Step 4 — Export */}
            <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4 shadow-sm">
              <div className="flex items-center gap-2">
                <StepNum done={!!d.rows}>4</StepNum>
                <h2 className="text-sm font-semibold">Export</h2>
              </div>

              {d.rows && d.rows.length > 0 && (
                <>
                  <div className="flex flex-wrap gap-4">
                    <Stat v={String(d.rows.length)} k="points" />
                    <Stat
                      v={`${fmt(Math.min(...d.rows.map((r) => r[0])))} – ${fmt(Math.max(...d.rows.map((r) => r[0])))}`}
                      k={d.xLabel || "x range"}
                    />
                    <Stat
                      v={`${fmt(Math.min(...d.rows.map((r) => r[1])))} – ${fmt(Math.max(...d.rows.map((r) => r[1])))}`}
                      k={d.yLabel || "y range"}
                    />
                  </div>
                  <MiniChart rows={d.rows} />
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
                      <PreviewRows rows={d.rows} />
                    </tbody>
                  </table>
                </>
              )}

              <Button
                disabled={!d.rows}
                onClick={d.exportCsv}
                className="w-full"
              >
                <Download />
                Export CSV
              </Button>

              {(d.status.msg || d.computeHint) && (
                <p
                  className={cn(
                    "text-xs",
                    d.status.error
                      ? "text-destructive"
                      : "text-muted-foreground"
                  )}
                >
                  {d.status.msg || d.computeHint}
                </p>
              )}
            </div>
          </aside>
        </div>

        <footer className="text-xs leading-relaxed text-muted-foreground">
          Works fully in your browser — nothing is uploaded anywhere. If a click
          doesn&apos;t land on a thin line, zoom in first. Axis lines can be
          rotated or in a group with a transform — calibration is computed by
          projection onto each line&apos;s own direction, so that&apos;s fine.
        </footer>
      </div>
    </div>
  )
}

export default App
