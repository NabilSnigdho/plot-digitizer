import { useMemo } from "react"
import { create, useStore } from "zustand"
import { persist } from "zustand/middleware"
import { shallow } from "zustand/shallow"
import { useShallow } from "zustand/react/shallow"
import { temporal } from "zundo"
import { z } from "zod"
import type { AxisScale, PickMode, Sel } from "./types"
import { getRawEndpoints, prepareSvg, toRoot } from "./lib/svg"
import { AxisScaleSchema, calibrate, SampleCountSchema } from "./lib/calibrate"

const EMPTY_SEL: Sel = { xaxis: null, yaxis: null, curve: null }

// Changes closer together than this (e.g. typing a label) share one undo step.
const HISTORY_BURST_MS = 500
const HISTORY_LIMIT = 100

// Validates what persist reads back from localStorage; anything else is dropped.
const PersistedSchema = z.object({
  xScale: AxisScaleSchema,
  yScale: AxisScaleSchema,
  xLabel: z.string(),
  yLabel: z.string(),
  sampleCount: SampleCountSchema,
})

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

// The part of the state that undo/redo tracks: selections and the form.
const tracked = ({
  sel,
  xStart,
  xEnd,
  yStart,
  yEnd,
  xScale,
  yScale,
  xLabel,
  yLabel,
  sampleCount,
}: DigitizerState) => ({
  sel,
  xStart,
  xEnd,
  yStart,
  yEnd,
  xScale,
  yScale,
  xLabel,
  yLabel,
  sampleCount,
})

export const useDigitizer = create<DigitizerState>()(
  temporal(
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
          // old selections point into the previous drawing
          useDigitizer.temporal.getState().clear()
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
        merge: (persisted, current) => {
          const parsed = PersistedSchema.safeParse(persisted)
          return parsed.success ? { ...current, ...parsed.data } : current
        },
      }
    ),
    {
      partialize: tracked,
      equality: shallow,
      limit: HISTORY_LIMIT,
      handleSet: (handleSet) => {
        let last = 0
        return (pastState) => {
          const now = Date.now()
          const burst = now - last < HISTORY_BURST_MS
          last = now
          if (!burst) handleSet(pastState)
          else useDigitizer.temporal.setState({ futureStates: [] })
        }
      },
    }
  )
)

// restoring persisted settings isn't an undoable edit
useDigitizer.temporal.getState().clear()

export function useHistory() {
  return useStore(
    useDigitizer.temporal,
    useShallow((s) => ({
      undo: s.undo,
      redo: s.redo,
      canUndo: s.pastStates.length > 0,
      canRedo: s.futureStates.length > 0,
    }))
  )
}

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
