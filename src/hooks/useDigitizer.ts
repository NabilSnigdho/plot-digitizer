import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import type { PickMode, SVGShape, Sel, FormVals, SelBools } from "../types"
import { C } from "../constants"
import {
  getRawEndpoints,
  projectOntoLine,
  svgViewWidth,
  resetShapeStyle,
} from "../lib/svg"
import { csvCell } from "../lib/format"

export function useDigitizer() {
  // ── form state ─────────────────────────────────────────────────────────────
  const [xValStart, setXValStart] = useState("")
  const [xValEnd, setXValEnd] = useState("")
  const [yValStart, setYValStart] = useState("")
  const [yValEnd, setYValEnd] = useState("")
  const [xLabel, setXLabel] = useState("Energy_keV")
  const [yLabel, setYLabel] = useState("Intensity")
  const [sampleCount, setSampleCount] = useState("500")

  // ── ui state ───────────────────────────────────────────────────────────────
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
  const [rows, setRows] = useState<[number, number][] | null>(null)

  // ── DOM refs ───────────────────────────────────────────────────────────────
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

  // ── recompute ──────────────────────────────────────────────────────────────
  // Stable callback — reads only from refs so it never goes stale.
  // Called from event handlers and form onChange, not from effects.
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
      let p = { x: local.x, y: local.y }
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

  // ── markers ────────────────────────────────────────────────────────────────
  const drawMarkers = useCallback(() => {
    const ml = markersRef.current
    const svg = svgRootRef.current
    if (!ml || !svg) return
    while (ml.firstChild) ml.removeChild(ml.firstChild)
    const r = svgViewWidth(svg) / 130
    const addDot = (pt: { x: number; y: number }, color: string) => {
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

  // ── shape events ───────────────────────────────────────────────────────────
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
        const toRoot = (pt: { x: number; y: number }) => {
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

  // ── SVG loading ────────────────────────────────────────────────────────────
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

  // ── callback refs (avoid exposing RefObjects in return value) ────────────
  const setStageRef = useCallback((el: HTMLDivElement | null) => {
    stageRef.current = el
  }, [])
  const setFileInputRef = useCallback((el: HTMLInputElement | null) => {
    fileInputRef.current = el
  }, [])
  const openFilePicker = useCallback(() => {
    fileInputRef.current?.click()
  }, [])

  // ── export ─────────────────────────────────────────────────────────────────
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

  // ── derived hint ───────────────────────────────────────────────────────────
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

  // ── form handlers ──────────────────────────────────────────────────────────
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

  const swapX = useCallback(() => {
    setXValStart(xValEnd)
    setXValEnd(xValStart)
    formRef.current.xValStart = xValEnd
    formRef.current.xValEnd = xValStart
    recompute()
  }, [xValStart, xValEnd, recompute])

  const swapY = useCallback(() => {
    setYValStart(yValEnd)
    setYValEnd(yValStart)
    formRef.current.yValStart = yValEnd
    formRef.current.yValEnd = yValStart
    recompute()
  }, [yValStart, yValEnd, recompute])

  return {
    // SVG loading
    svgLoaded,
    fileName,
    globalStatus,
    setStageRef,
    setFileInputRef,
    openFilePicker,
    loadFile,
    dragOver,
    setDragOver,
    // zoom
    zoom,
    setZoom,
    // pick mode
    pickMode,
    setPickMode,
    // selection state
    xSel,
    ySel,
    curveSel,
    curveLen,
    // form values + handlers
    xValStart,
    handleXValStart,
    xValEnd,
    handleXValEnd,
    yValStart,
    handleYValStart,
    yValEnd,
    handleYValEnd,
    xLabel,
    setXLabel,
    yLabel,
    setYLabel,
    sampleCount,
    handleSampleCount,
    swapX,
    swapY,
    // output
    rows,
    computeHint,
    status,
    exportCsv,
  }
}
