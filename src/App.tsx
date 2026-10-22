import {
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react"
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

// ─── types ────────────────────────────────────────────────────────────────────

type PickMode = "xaxis" | "yaxis" | "curve" | null
type SVGShape = SVGGraphicsElement & { __role?: string }

interface Pt {
  x: number
  y: number
}
interface AxisSel {
  el: SVGShape
  p0: Pt
  p1: Pt
}
interface CurveSel {
  el: SVGPathElement
  length: number
}
interface Sel {
  xaxis: AxisSel | null
  yaxis: AxisSel | null
  curve: CurveSel | null
}
interface FormVals {
  xValStart: string
  xValEnd: string
  yValStart: string
  yValEnd: string
  sampleCount: string
}
interface SelBools {
  xSel: boolean
  ySel: boolean
  curveSel: boolean
}

// ─── colors ───────────────────────────────────────────────────────────────────

const C = {
  x: "#0d9488",
  x2: "#0f766e",
  y: "#ea580c",
  y2: "#c2410c",
  curve: "#ca8a04",
  neutral: "#94a3b8",
  hover: "#6366f1",
} as const

// ─── pure helpers ─────────────────────────────────────────────────────────────

function fmt(v: number): string {
  const av = Math.abs(v)
  if (av !== 0 && (av < 0.001 || av >= 100_000)) return v.toExponential(2)
  return (Math.round(v * 1000) / 1000).toString()
}

function csvCell(s: string): string {
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

function getRawEndpoints(el: SVGShape): [Pt, Pt] {
  const tag = el.tagName.toLowerCase()
  if (tag === "line") {
    return [
      { x: +(el.getAttribute("x1") ?? 0), y: +(el.getAttribute("y1") ?? 0) },
      { x: +(el.getAttribute("x2") ?? 0), y: +(el.getAttribute("y2") ?? 0) },
    ]
  }
  if (tag === "polyline" || tag === "polygon") {
    const pts = (el as SVGPolylineElement).points
    if (!pts || pts.numberOfItems < 2)
      throw new Error("that shape has too few points")
    const a = pts.getItem(0)
    const b = pts.getItem(pts.numberOfItems - 1)
    return [
      { x: a.x, y: a.y },
      { x: b.x, y: b.y },
    ]
  }
  if (tag === "path") {
    const p = el as SVGPathElement
    const total = p.getTotalLength()
    if (!total) throw new Error("that path has zero length")
    const p0 = p.getPointAtLength(0)
    const p1 = p.getPointAtLength(total)
    return [
      { x: p0.x, y: p0.y },
      { x: p1.x, y: p1.y },
    ]
  }
  throw new Error("unsupported element type: " + tag)
}

function projectOntoLine(p: Pt, a: Pt, b: Pt): number {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const denom = dx * dx + dy * dy
  if (denom === 0) return NaN
  return ((p.x - a.x) * dx + (p.y - a.y) * dy) / denom
}

function svgViewWidth(svg: SVGSVGElement): number {
  const vb = svg.viewBox?.baseVal
  if (vb?.width) return vb.width
  try {
    return svg.getBBox().width || 500
  } catch {
    return 500
  }
}

function resetShapeStyle(el: SVGShape) {
  delete el.__role
  el.style.stroke = C.neutral
  el.style.strokeOpacity = "0.55"
  el.style.strokeWidth = "2"
}

// ─── App ──────────────────────────────────────────────────────────────────────

export function App() {
  // form state (drives controlled inputs)
  const [xValStart, setXValStart] = useState("")
  const [xValEnd, setXValEnd] = useState("")
  const [yValStart, setYValStart] = useState("")
  const [yValEnd, setYValEnd] = useState("")
  const [xLabel, setXLabel] = useState("Energy_keV")
  const [yLabel, setYLabel] = useState("Intensity")
  const [sampleCount, setSampleCount] = useState("500")

  // ui state
  const [svgLoaded, setSvgLoaded] = useState(false)
  const [fileName, setFileName] = useState("")
  const [globalStatus, setGlobalStatus] = useState("No file loaded")
  const [pickMode, setPickMode] = useState<PickMode>(null)
  const [xSel, setXSel] = useState(false)
  const [ySel, setYSel] = useState(false)
  const [curveSel, setCurveSel] = useState(false)
  const [curveLen, setCurveLen] = useState("")
  const [zoom, setZoom] = useState(1)
  const [dragOver, setDragOver] = useState(false)
  const [status, setStatus] = useState({ msg: "", error: false })

  // output state — set from event handlers, never from effects
  const [rows, setRows] = useState<[number, number][] | null>(null)

  // DOM refs
  const stageRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const svgRootRef = useRef<SVGSVGElement | null>(null)
  const markersRef = useRef<SVGGElement | null>(null)
  const pickModeRef = useRef<PickMode>(null)
  const selRef = useRef<Sel>({ xaxis: null, yaxis: null, curve: null })

  // mirror refs for stable callbacks (avoids stale closures on form/selection data)
  const formRef = useRef<FormVals>({
    xValStart: "",
    xValEnd: "",
    yValStart: "",
    yValEnd: "",
    sampleCount: "500",
  })
  const selBoolsRef = useRef<SelBools>({
    xSel: false,
    ySel: false,
    curveSel: false,
  })

  useEffect(() => {
    pickModeRef.current = pickMode
  }, [pickMode])

  useEffect(() => {
    if (!svgRootRef.current) return
    svgRootRef.current.style.width = `${640 * zoom}px`
  }, [zoom])

  // ── recompute ────────────────────────────────────────────────────────────────
  // Stable callback — reads only from refs so it never goes stale.
  // Called from event handlers (shape click, form onChange), not from effects.

  const recompute = useCallback(() => {
    const { xValStart, xValEnd, yValStart, yValEnd, sampleCount } =
      formRef.current
    const { xSel, ySel, curveSel } = selBoolsRef.current
    const sel = selRef.current
    const svg = svgRootRef.current

    if (
      !sel.xaxis ||
      !sel.yaxis ||
      !sel.curve ||
      !xSel ||
      !ySel ||
      !curveSel ||
      !svg
    ) {
      setRows(null)
      return
    }

    const x0 = parseFloat(xValStart)
    const x1 = parseFloat(xValEnd)
    const y0 = parseFloat(yValStart)
    const y1 = parseFloat(yValEnd)
    if ([x0, x1, y0, y1].some(Number.isNaN)) {
      setRows(null)
      return
    }

    let n = parseInt(sampleCount, 10)
    if (!n || n < 10) n = 10
    if (n > 5000) n = 5000

    const { curve, xaxis, yaxis } = sel
    const total = curve.length
    const computed: [number, number][] = []

    for (let i = 0; i < n; i++) {
      const len = (i / (n - 1)) * total
      const local = curve.el.getPointAtLength(len)
      const ctm = curve.el.getCTM()
      let p: Pt = { x: local.x, y: local.y }
      if (ctm) {
        const sp = svg.createSVGPoint()
        sp.x = local.x
        sp.y = local.y
        const t = sp.matrixTransform(ctm)
        p = { x: t.x, y: t.y }
      }
      const tx = projectOntoLine(p, xaxis.p0, xaxis.p1)
      const ty = projectOntoLine(p, yaxis.p0, yaxis.p1)
      computed.push([x0 + tx * (x1 - x0), y0 + ty * (y1 - y0)])
    }
    computed.sort((a, b) => a[0] - b[0])
    setRows(computed)
  }, [])

  // ── markers ──────────────────────────────────────────────────────────────────

  const drawMarkers = useCallback(() => {
    const ml = markersRef.current
    const svg = svgRootRef.current
    if (!ml || !svg) return
    while (ml.firstChild) ml.removeChild(ml.firstChild)
    const r = svgViewWidth(svg) / 130
    const addDot = (pt: Pt, color: string) => {
      const c = document.createElementNS("http://www.w3.org/2000/svg", "circle")
      c.setAttribute("cx", String(pt.x))
      c.setAttribute("cy", String(pt.y))
      c.setAttribute("r", String(r))
      c.setAttribute("fill", color)
      c.setAttribute("stroke", color)
      c.setAttribute("stroke-width", String(r * 0.35))
      c.style.pointerEvents = "none"
      ml.appendChild(c)
    }
    const { xaxis, yaxis } = selRef.current
    if (xaxis) {
      addDot(xaxis.p0, C.x)
      addDot(xaxis.p1, C.x2)
    }
    if (yaxis) {
      addDot(yaxis.p0, C.y)
      addDot(yaxis.p1, C.y2)
    }
  }, [])

  // ── shape events ─────────────────────────────────────────────────────────────

  const onShapeHoverEnter = useCallback((e: Event) => {
    if (!pickModeRef.current) return
    const el = e.currentTarget as SVGShape
    if (el.__role) return
    el.style.stroke = C.hover
    el.style.strokeOpacity = "1"
    el.style.strokeWidth = "3"
  }, [])

  const onShapeHoverLeave = useCallback((e: Event) => {
    const el = e.currentTarget as SVGShape
    if (el.__role || !pickModeRef.current) return
    el.style.stroke = C.neutral
    el.style.strokeOpacity = "0.55"
    el.style.strokeWidth = "2"
  }, [])

  const onShapeClick = useCallback(
    (e: Event) => {
      const pm = pickModeRef.current
      if (!pm) return
      const el = e.currentTarget as SVGShape
      const svg = svgRootRef.current
      if (!svg) return

      try {
        const prev =
          pm === "xaxis"
            ? selRef.current.xaxis
            : pm === "yaxis"
              ? selRef.current.yaxis
              : selRef.current.curve
        if (prev && prev.el !== el) resetShapeStyle(prev.el as SVGShape)

        if (pm === "curve" && el.tagName.toLowerCase() !== "path") {
          throw new Error(
            "pick a bezier path for the curve, not a straight line"
          )
        }

        const [rawP0, rawP1] = getRawEndpoints(el)
        const toRoot = (pt: Pt): Pt => {
          const ctm = el.getCTM()
          if (!ctm) return { x: pt.x, y: pt.y }
          const sp = svg.createSVGPoint()
          sp.x = pt.x
          sp.y = pt.y
          const t = sp.matrixTransform(ctm)
          return { x: t.x, y: t.y }
        }
        const p0 = toRoot(rawP0)
        const p1 = toRoot(rawP1)

        el.__role = pm
        const color = pm === "xaxis" ? C.x : pm === "yaxis" ? C.y : C.curve
        el.style.stroke = color
        el.style.strokeOpacity = "0.9"
        el.style.strokeWidth = pm === "curve" ? "2.5" : "2"

        if (pm === "xaxis") {
          selRef.current.xaxis = { el, p0, p1 }
          selBoolsRef.current.xSel = true
          setXSel(true)
        } else if (pm === "yaxis") {
          selRef.current.yaxis = { el, p0, p1 }
          selBoolsRef.current.ySel = true
          setYSel(true)
        } else {
          const pathEl = el as SVGPathElement
          const len = pathEl.getTotalLength()
          selRef.current.curve = { el: pathEl, length: len }
          selBoolsRef.current.curveSel = true
          setCurveSel(true)
          setCurveLen(len.toFixed(1) + " px")
        }

        drawMarkers()
        recompute()
        setStatus({ msg: "", error: false })
      } catch (err) {
        setStatus({ msg: (err as Error).message, error: true })
        return
      }

      setPickMode(null)
    },
    [drawMarkers, recompute]
  )

  // ── SVG loading ───────────────────────────────────────────────────────────────

  const injectSvg = useCallback(
    (svgText: string, name: string) => {
      const doc = new DOMParser().parseFromString(svgText, "image/svg+xml")
      if (doc.querySelector("parsererror"))
        throw new Error("invalid SVG markup")
      const incoming = doc.documentElement as unknown as SVGSVGElement
      if (incoming.tagName.toLowerCase() !== "svg")
        throw new Error("root element is not <svg>")
      incoming.querySelectorAll("script").forEach((n) => n.remove())

      const stage = stageRef.current
      if (!stage) return
      stage.innerHTML = ""
      stage.appendChild(incoming)
      svgRootRef.current = incoming
      incoming.style.width = "640px"
      incoming.style.height = "auto"
      incoming.removeAttribute("height")

      selRef.current = { xaxis: null, yaxis: null, curve: null }
      selBoolsRef.current = { xSel: false, ySel: false, curveSel: false }
      setXSel(false)
      setYSel(false)
      setCurveSel(false)
      setRows(null)
      setPickMode(null)

      const shapes = incoming.querySelectorAll("path, line, polyline, polygon")
      if (!shapes.length)
        throw new Error("no path/line/polyline elements found")
      shapes.forEach((el) => {
        const shape = el as SVGShape
        shape.style.fill = "none"
        shape.style.stroke = C.neutral
        shape.style.strokeOpacity = "0.55"
        shape.style.strokeWidth = "2"
        shape.style.vectorEffect = "non-scaling-stroke"
        shape.style.cursor = "crosshair"
        shape.style.pointerEvents = "stroke"
        shape.addEventListener("mouseenter", onShapeHoverEnter)
        shape.addEventListener("mouseleave", onShapeHoverLeave)
        shape.addEventListener("click", onShapeClick)
      })
      incoming
        .querySelectorAll("image")
        .forEach((img) => ((img as SVGElement).style.pointerEvents = "none"))

      const ml = document.createElementNS("http://www.w3.org/2000/svg", "g")
      ml.setAttribute("id", "__digitizer_markers")
      incoming.appendChild(ml)
      markersRef.current = ml

      setSvgLoaded(true)
      setFileName(name)
      setGlobalStatus("File loaded — pick your calibration lines")
      setStatus({ msg: "", error: false })
      setZoom(1)
    },
    [onShapeHoverEnter, onShapeHoverLeave, onShapeClick]
  )

  const loadFile = useCallback(
    (file: File) => {
      if (!/svg/i.test(file.type) && !/\.svg$/i.test(file.name)) {
        setStatus({ msg: "That doesn't look like an SVG file.", error: true })
        return
      }
      const reader = new FileReader()
      reader.onload = () => {
        try {
          injectSvg(reader.result as string, file.name)
        } catch (err) {
          setStatus({
            msg: "Could not parse SVG: " + (err as Error).message,
            error: true,
          })
        }
      }
      reader.readAsText(file)
    },
    [injectSvg]
  )

  // ── export ───────────────────────────────────────────────────────────────────

  const exportCsv = useCallback(() => {
    if (!rows) return
    let csv = `${csvCell(xLabel)},${csvCell(yLabel)}\n`
    for (const [x, y] of rows) csv += `${x.toFixed(6)},${y.toFixed(6)}\n`
    const blob = new Blob([csv], { type: "text/csv" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = "digitized_curve.csv"
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
    setStatus({ msg: "Downloaded.", error: false })
  }, [rows, xLabel, yLabel])

  // ── derived hint (pure state, no refs) ───────────────────────────────────────

  const computeHint = useMemo(
    () =>
      xSel &&
      ySel &&
      curveSel &&
      [xValStart, xValEnd, yValStart, yValEnd].some((v) =>
        Number.isNaN(parseFloat(v))
      )
        ? "Enter all four calibration values to compute the curve."
        : "",
    [xSel, ySel, curveSel, xValStart, xValEnd, yValStart, yValEnd]
  )

  // ── combined onChange helpers ─────────────────────────────────────────────────

  const handleXValStart = useCallback(
    (v: string) => {
      setXValStart(v)
      formRef.current.xValStart = v
      recompute()
    },
    [recompute]
  )
  const handleXValEnd = useCallback(
    (v: string) => {
      setXValEnd(v)
      formRef.current.xValEnd = v
      recompute()
    },
    [recompute]
  )
  const handleYValStart = useCallback(
    (v: string) => {
      setYValStart(v)
      formRef.current.yValStart = v
      recompute()
    },
    [recompute]
  )
  const handleYValEnd = useCallback(
    (v: string) => {
      setYValEnd(v)
      formRef.current.yValEnd = v
      recompute()
    },
    [recompute]
  )
  const handleSampleCount = useCallback(
    (v: string) => {
      setSampleCount(v)
      formRef.current.sampleCount = v
      recompute()
    },
    [recompute]
  )

  // ── render ───────────────────────────────────────────────────────────────────

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
              svgLoaded
                ? "border-primary/20 bg-primary/10 text-primary"
                : "border-border bg-muted text-muted-foreground"
            )}
          >
            {globalStatus}
          </span>
        </header>

        <div className="flex flex-wrap items-start gap-4 lg:flex-nowrap">
          {/* Canvas */}
          <section className="min-w-0 flex-1 overflow-hidden rounded-xl border border-border bg-card shadow-sm">
            <div className="flex flex-wrap items-center gap-2 border-b border-border px-3 py-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload />
                Upload SVG
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".svg,image/svg+xml"
                hidden
                onChange={(e) => {
                  const f = e.target.files?.[0]
                  if (f) loadFile(f)
                }}
              />
              {fileName && (
                <span className="max-w-[200px] truncate text-xs text-muted-foreground">
                  {fileName}
                </span>
              )}
              <div className="flex-1" />
              <Button
                size="icon-sm"
                variant="ghost"
                disabled={!svgLoaded}
                onClick={() => setZoom((z) => Math.max(0.25, z / 1.4))}
              >
                <ZoomOut />
              </Button>
              <span className="w-12 text-center text-xs text-muted-foreground tabular-nums">
                {Math.round(zoom * 100)}%
              </span>
              <Button
                size="icon-sm"
                variant="ghost"
                disabled={!svgLoaded}
                onClick={() => setZoom((z) => Math.min(6, z * 1.4))}
              >
                <ZoomIn />
              </Button>
              <Button
                size="icon-sm"
                variant="ghost"
                disabled={!svgLoaded}
                onClick={() => setZoom(1)}
              >
                <Maximize2 />
              </Button>
            </div>

            {/* Stage */}
            <div
              className={cn(
                "relative overflow-auto bg-muted/40",
                dragOver && "ring-2 ring-primary ring-inset"
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
                setDragOver(true)
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault()
                setDragOver(false)
                const f = e.dataTransfer.files?.[0]
                if (f) loadFile(f)
              }}
            >
              <div className="inline-block min-h-full min-w-full p-6">
                <div ref={stageRef} />
              </div>
              {!svgLoaded && (
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
            <StepCard number={1} title="Calibrate X axis" done={xSel}>
              <p className="text-xs text-muted-foreground">
                Click the straight line along the x-axis. First node ={" "}
                <b>start</b>, last = <b>end</b>.
              </p>
              <Button
                size="sm"
                variant={pickMode === "xaxis" ? "default" : "outline"}
                disabled={!svgLoaded}
                onClick={() =>
                  setPickMode((m) => (m === "xaxis" ? null : "xaxis"))
                }
              >
                {pickMode === "xaxis"
                  ? "Click a line in the drawing…"
                  : "Pick X-axis line"}
              </Button>
              {xSel && (
                <SelTag color="teal">
                  <Button
                    size="xs"
                    variant="ghost"
                    onClick={() => {
                      setXValStart(xValEnd)
                      setXValEnd(xValStart)
                      formRef.current.xValStart = xValEnd
                      formRef.current.xValEnd = xValStart
                      recompute()
                    }}
                  >
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
                    value={xValStart}
                    onChange={handleXValStart}
                  />
                </FieldGroup>
                <FieldGroup
                  label={<DotLabel color="bg-teal-700" text="value at end" />}
                >
                  <NumInput
                    placeholder="20"
                    value={xValEnd}
                    onChange={handleXValEnd}
                  />
                </FieldGroup>
              </div>
              <FieldGroup label="Column name">
                <TxtInput value={xLabel} onChange={setXLabel} />
              </FieldGroup>
            </StepCard>

            {/* Step 2 — Y axis */}
            <StepCard number={2} title="Calibrate Y axis" done={ySel}>
              <p className="text-xs text-muted-foreground">
                Same idea, along the y-axis.
              </p>
              <Button
                size="sm"
                variant={pickMode === "yaxis" ? "default" : "outline"}
                disabled={!svgLoaded}
                onClick={() =>
                  setPickMode((m) => (m === "yaxis" ? null : "yaxis"))
                }
              >
                {pickMode === "yaxis"
                  ? "Click a line in the drawing…"
                  : "Pick Y-axis line"}
              </Button>
              {ySel && (
                <SelTag color="orange">
                  <Button
                    size="xs"
                    variant="ghost"
                    onClick={() => {
                      setYValStart(yValEnd)
                      setYValEnd(yValStart)
                      formRef.current.yValStart = yValEnd
                      formRef.current.yValEnd = yValStart
                      recompute()
                    }}
                  >
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
                    value={yValStart}
                    onChange={handleYValStart}
                  />
                </FieldGroup>
                <FieldGroup
                  label={<DotLabel color="bg-orange-700" text="value at end" />}
                >
                  <NumInput
                    placeholder="6000"
                    value={yValEnd}
                    onChange={handleYValEnd}
                  />
                </FieldGroup>
              </div>
              <FieldGroup label="Column name">
                <TxtInput value={yLabel} onChange={setYLabel} />
              </FieldGroup>
            </StepCard>

            {/* Step 3 — Curve */}
            <StepCard number={3} title="Pick the traced curve" done={curveSel}>
              <p className="text-xs text-muted-foreground">
                Click the bezier path traced over the data. Must be a path, not
                a straight calibration line.
              </p>
              <Button
                size="sm"
                variant={pickMode === "curve" ? "default" : "outline"}
                disabled={!svgLoaded}
                onClick={() =>
                  setPickMode((m) => (m === "curve" ? null : "curve"))
                }
              >
                {pickMode === "curve"
                  ? "Click the curve in the drawing…"
                  : "Pick curve path"}
              </Button>
              {curveSel && (
                <SelTag color="amber">
                  <span className="font-mono text-muted-foreground">
                    {curveLen}
                  </span>
                </SelTag>
              )}
              <FieldGroup label="Sample points">
                <NumInput
                  placeholder="500"
                  value={sampleCount}
                  onChange={handleSampleCount}
                />
              </FieldGroup>
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
                    <Stat
                      v={`${fmt(Math.min(...rows.map((r) => r[0])))} – ${fmt(Math.max(...rows.map((r) => r[0])))}`}
                      k={xLabel || "x range"}
                    />
                    <Stat
                      v={`${fmt(Math.min(...rows.map((r) => r[1])))} – ${fmt(Math.max(...rows.map((r) => r[1])))}`}
                      k={yLabel || "y range"}
                    />
                  </div>
                  <MiniChart rows={rows} />
                  <table className="w-full border-collapse text-xs">
                    <thead>
                      <tr>
                        <th className="border-b border-border px-2 py-1 text-left font-medium text-muted-foreground">
                          {xLabel || "X"}
                        </th>
                        <th className="border-b border-border px-2 py-1 text-right font-medium text-muted-foreground">
                          {yLabel || "Y"}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      <PreviewRows rows={rows} />
                    </tbody>
                  </table>
                </>
              )}

              <Button disabled={!rows} onClick={exportCsv} className="w-full">
                <Download />
                Export CSV
              </Button>

              {(status.msg || computeHint) && (
                <p
                  className={cn(
                    "text-xs",
                    status.error ? "text-destructive" : "text-muted-foreground"
                  )}
                >
                  {status.msg || computeHint}
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

// ─── sub-components ───────────────────────────────────────────────────────────

function StepCard({
  number,
  title,
  done,
  children,
}: {
  number: number
  title: string
  done: boolean
  children: ReactNode
}) {
  return (
    <div
      className={cn(
        "rounded-xl border border-border bg-card p-4 shadow-sm",
        done && "border-primary/30"
      )}
    >
      <div className="mb-3 flex items-center gap-2">
        <StepNum done={done}>{number}</StepNum>
        <h2 className="text-sm font-semibold">{title}</h2>
      </div>
      <div className="flex flex-col gap-2">{children}</div>
    </div>
  )
}

function StepNum({ done, children }: { done: boolean; children: ReactNode }) {
  return (
    <span
      className={cn(
        "flex size-5 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
        done
          ? "bg-primary text-primary-foreground"
          : "bg-muted text-muted-foreground"
      )}
    >
      {children}
    </span>
  )
}

function SelTag({
  color,
  children,
}: {
  color: "teal" | "orange" | "amber"
  children: ReactNode
}) {
  const dot =
    color === "teal"
      ? "bg-teal-500"
      : color === "orange"
        ? "bg-orange-500"
        : "bg-amber-500"
  return (
    <div className="flex items-center justify-between rounded-lg bg-muted px-3 py-1.5 text-xs">
      <span className="flex items-center gap-1.5">
        <span className={cn("size-2 shrink-0 rounded-full", dot)} />
        {color === "amber" ? "curve" : "line"} selected
      </span>
      {children}
    </div>
  )
}

function FieldGroup({
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

function DotLabel({ color, text }: { color: string; text: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={cn("size-2 shrink-0 rounded-full", color)} />
      {text}
    </span>
  )
}

function NumInput({
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

function TxtInput({
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

function Stat({ v, k }: { v: string; k: string }) {
  return (
    <div className="flex flex-col">
      <span className="font-mono text-base tabular-nums">{v}</span>
      <span className="text-[10px] tracking-wider text-muted-foreground uppercase">
        {k}
      </span>
    </div>
  )
}

function PreviewRows({ rows }: { rows: [number, number][] }) {
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

function MiniChart({ rows }: { rows: [number, number][] }) {
  const [hover, setHover] = useState<{
    x: number
    y: number
    px: number
    py: number
  } | null>(null)

  const W = 300
  const H = 120
  const PAD = 8

  const xs = rows.map((r) => r[0])
  const ys = rows.map((r) => r[1])
  const xMin = Math.min(...xs)
  const xMax = Math.max(...xs)
  const yMin = Math.min(...ys)
  const yMax = Math.max(...ys)
  const xSpan = xMax - xMin || 1
  const ySpan = yMax - yMin || 1
  const innerW = W - PAD * 2
  const innerH = H - PAD * 2

  const sx = (x: number) => PAD + ((x - xMin) / xSpan) * innerW
  const sy = (y: number) => H - PAD - ((y - yMin) / ySpan) * innerH

  const pts = rows
    .map((r) => `${sx(r[0]).toFixed(1)},${sy(r[1]).toFixed(1)}`)
    .join(" L ")
  const d = `M ${pts}`
  const areaD = `${d} L ${sx(xMax).toFixed(1)},${H - PAD} L ${sx(xMin).toFixed(1)},${H - PAD} Z`

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<SVGSVGElement>) => {
      const rect = e.currentTarget.getBoundingClientRect()
      const mx = ((e.clientX - rect.left) / rect.width) * W
      const xVal = xMin + ((mx - PAD) / innerW) * xSpan
      let lo = 0
      let hi = rows.length - 1
      while (lo < hi) {
        const mid = (lo + hi) >> 1
        if (rows[mid][0] < xVal) lo = mid + 1
        else hi = mid
      }
      const row = rows[lo]
      if (!row) return
      setHover({
        x: row[0],
        y: row[1],
        px: PAD + ((row[0] - xMin) / xSpan) * innerW,
        py: H - PAD - ((row[1] - yMin) / ySpan) * innerH,
      })
    },
    [rows, xMin, xSpan, yMin, ySpan, innerW, innerH]
  )

  return (
    <div className="relative">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        width="100%"
        height={H}
        preserveAspectRatio="none"
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setHover(null)}
        className="block"
      >
        <line
          x1={PAD}
          y1={H - PAD}
          x2={W - PAD}
          y2={H - PAD}
          stroke="currentColor"
          strokeOpacity={0.15}
          strokeWidth={1}
        />
        <path d={areaD} fill={C.curve} fillOpacity={0.12} stroke="none" />
        <path
          d={d}
          fill="none"
          stroke={C.curve}
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        {hover && (
          <>
            <line
              x1={hover.px}
              y1={PAD}
              x2={hover.px}
              y2={H - PAD}
              stroke="currentColor"
              strokeOpacity={0.3}
              strokeWidth={1}
            />
            <circle cx={hover.px} cy={hover.py} r={3} fill={C.curve} />
          </>
        )}
      </svg>
      {hover && (
        <div
          className="pointer-events-none absolute rounded bg-foreground px-2 py-0.5 font-mono text-xs text-background"
          style={{
            left: `${(hover.px / W) * 100}%`,
            top: `${(hover.py / H) * 100}%`,
            transform: "translate(-50%, -130%)",
          }}
        >
          {fmt(hover.x)}, {fmt(hover.y)}
        </div>
      )}
    </div>
  )
}

export default App
