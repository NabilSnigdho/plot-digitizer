import { useMemo } from "react"
import { create } from "zustand"
import { persist } from "zustand/middleware"
import { useShallow } from "zustand/react/shallow"
import type { AxisScale, PickMode, Sel } from "./types"
import { getRawEndpoints, prepareSvg, toRoot } from "./lib/svg"
import { calibrate } from "./lib/calibrate"

const EMPTY_SEL: Sel = { xaxis: null, yaxis: null, curve: null }

interface DigitizerState {
  // drawing
  svg: SVGSVGElement | null
  fileName: string
  pickMode: PickMode
  sel: Sel
  // calibration form
  xStart: number | null
  xEnd: number | null
  yStart: number | null
  yEnd: number | null
  xScale: AxisScale
  yScale: AxisScale
  xLabel: string
  yLabel: string
  sampleCount: number

  loadFile: (file: File) => Promise<void>
  togglePickMode: (mode: Exclude<PickMode, null>) => void
  pick: (el: SVGGraphicsElement) => void
  swap: (axis: "x" | "y") => void
}

export const useDigitizer = create<DigitizerState>()(
  persist(
    (set, get) => ({
      svg: null,
      fileName: "",
      pickMode: null,
      sel: EMPTY_SEL,
      xStart: null,
      xEnd: null,
      yStart: null,
      yEnd: null,
      xScale: "linear",
      yScale: "linear",
      xLabel: "Energy_keV",
      yLabel: "Intensity",
      sampleCount: 500,

      loadFile: async (file) => {
        if (!/svg/i.test(file.type) && !/\.svg$/i.test(file.name))
          throw new Error("That doesn't look like an SVG file.")
        const svg = prepareSvg(await file.text())
        set({ svg, fileName: file.name, sel: EMPTY_SEL, pickMode: null })
      },

      togglePickMode: (mode) => {
        if (!get().svg) return
        set((s) => ({ pickMode: s.pickMode === mode ? null : mode }))
      },

      pick: (el) => {
        const { pickMode, sel } = get()
        if (!pickMode) return
        if (pickMode === "curve") {
          if (!(el instanceof SVGPathElement))
            throw new Error(
              "pick a bezier path for the curve, not a straight line"
            )
          const curve = { el, length: el.getTotalLength() }
          set({ sel: { ...sel, curve }, pickMode: null })
          return
        }
        const [a, b] = getRawEndpoints(el)
        const axis = { el, p0: toRoot(el, a), p1: toRoot(el, b) }
        set({ sel: { ...sel, [pickMode]: axis }, pickMode: null })
      },

      swap: (axis) =>
        set((s) =>
          axis === "x"
            ? { xStart: s.xEnd, xEnd: s.xStart }
            : { yStart: s.yEnd, yEnd: s.yStart }
        ),
    }),
    {
      name: "plot-digitizer",
      partialize: (s) => ({
        xScale: s.xScale,
        yScale: s.yScale,
        xLabel: s.xLabel,
        yLabel: s.yLabel,
        sampleCount: s.sampleCount,
      }),
    }
  )
)

// Digitized rows, derived from the selection and calibration form.
export function useCalibration() {
  const input = useDigitizer(
    useShallow((s) => ({
      sel: s.sel,
      xStart: s.xStart,
      xEnd: s.xEnd,
      yStart: s.yStart,
      yEnd: s.yEnd,
      xScale: s.xScale,
      yScale: s.yScale,
      sampleCount: s.sampleCount,
    }))
  )
  return useMemo(
    () =>
      calibrate({
        sel: input.sel,
        x: { start: input.xStart, end: input.xEnd, scale: input.xScale },
        y: { start: input.yStart, end: input.yEnd, scale: input.yScale },
        sampleCount: input.sampleCount,
      }),
    [input]
  )
}
