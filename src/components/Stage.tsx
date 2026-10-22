import { useEffect, useRef, useState, type CSSProperties } from "react"
import { useDropzone } from "react-dropzone"
import { useHotkeys } from "react-hotkeys-hook"
import {
  TransformComponent,
  TransformWrapper,
  useControls,
  type ReactZoomPanPinchContentRef,
} from "react-zoom-pan-pinch"
import { cn } from "cn"
import { toast } from "sonner"
import { Maximize2, TrendingUp, Upload, ZoomIn, ZoomOut } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useDigitizer } from "../store"
import { renderSelection, SHAPE_CLASS } from "../lib/svg"
import { C } from "../constants"

// Moving further than this between pointerdown and click counts as a pan.
const CLICK_SLOP_PX = 4

const stageVars = {
  "--dg-x": C.x,
  "--dg-y": C.y,
  "--dg-curve": C.curve,
  "--dg-neutral": C.neutral,
  "--dg-hover": C.hover,
} as CSSProperties

const checkerboard: CSSProperties = {
  backgroundImage:
    "linear-gradient(45deg,oklch(0.85 0 0 / .4) 25%,transparent 25%)," +
    "linear-gradient(-45deg,oklch(0.85 0 0 / .4) 25%,transparent 25%)," +
    "linear-gradient(45deg,transparent 75%,oklch(0.85 0 0 / .4) 75%)," +
    "linear-gradient(-45deg,transparent 75%,oklch(0.85 0 0 / .4) 75%)",
  backgroundSize: "20px 20px",
  backgroundPosition: "0 0, 0 10px, 10px -10px, -10px 0px",
}

async function loadFile(file: File) {
  try {
    await useDigitizer.getState().loadFile(file)
  } catch (err) {
    toast.error("Could not load SVG", { description: (err as Error).message })
  }
}

export function Stage() {
  const svg = useDigitizer((s) => s.svg)
  const fileName = useDigitizer((s) => s.fileName)
  const pickMode = useDigitizer((s) => s.pickMode)
  const sel = useDigitizer((s) => s.sel)
  const hostRef = useRef<HTMLDivElement>(null)
  const zoomRef = useRef<ReactZoomPanPinchContentRef>(null)
  const [scale, setScale] = useState(1)

  const { getRootProps, getInputProps, open, isDragActive } = useDropzone({
    accept: { "image/svg+xml": [".svg"] },
    multiple: false,
    noClick: true,
    noKeyboard: true,
    onDropAccepted: ([file]) => loadFile(file),
    onDropRejected: () => toast.error("That doesn't look like an SVG file."),
  })

  // mount the drawing and handle shape clicks
  useEffect(() => {
    const host = hostRef.current
    if (!svg || !host) return
    host.replaceChildren(svg)
    zoomRef.current?.resetTransform(0)

    let down = { x: 0, y: 0 }
    const onPointerDown = (e: PointerEvent) => {
      down = { x: e.clientX, y: e.clientY }
    }
    const onClick = (e: MouseEvent) => {
      if (Math.hypot(e.clientX - down.x, e.clientY - down.y) > CLICK_SLOP_PX)
        return
      const el = (e.target as Element).closest(`.${SHAPE_CLASS}`)
      if (!el) return
      try {
        useDigitizer.getState().pick(el as SVGGraphicsElement)
      } catch (err) {
        toast.error((err as Error).message)
      }
    }
    svg.addEventListener("pointerdown", onPointerDown)
    svg.addEventListener("click", onClick)
    return () => {
      svg.removeEventListener("pointerdown", onPointerDown)
      svg.removeEventListener("click", onClick)
    }
  }, [svg])

  useEffect(() => {
    if (svg) renderSelection(svg, sel)
  }, [svg, sel])

  return (
    <section
      {...getRootProps({
        className:
          "min-w-0 flex-1 overflow-hidden rounded-xl border border-border bg-card shadow-sm",
      })}
    >
      <input {...getInputProps()} />
      <TransformWrapper
        ref={zoomRef}
        minScale={0.25}
        maxScale={20}
        doubleClick={{ disabled: true }}
        onTransform={(_, s) => setScale(s.scale)}
      >
        <div className="flex flex-wrap items-center gap-2 border-b border-border px-3 py-2">
          <Button size="sm" variant="outline" onClick={open}>
            <Upload />
            Upload SVG
          </Button>
          {fileName && (
            <span className="max-w-[200px] truncate text-xs text-muted-foreground">
              {fileName}
            </span>
          )}
          <div className="flex-1" />
          <ZoomControls disabled={!svg} scale={scale} />
        </div>

        <div
          className={cn(
            "dg-stage relative bg-muted/40",
            isDragActive && "ring-2 ring-primary ring-inset"
          )}
          data-picking={pickMode ? "" : undefined}
          style={{ ...stageVars, ...checkerboard }}
        >
          <TransformComponent
            wrapperStyle={{ width: "100%", height: "min(62vh, 620px)" }}
          >
            <div className="p-6">
              <div ref={hostRef} />
            </div>
          </TransformComponent>
          {!svg && (
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
      </TransformWrapper>
    </section>
  )
}

function ZoomControls({
  disabled,
  scale,
}: {
  disabled: boolean
  scale: number
}) {
  const { zoomIn, zoomOut, resetTransform } = useControls()
  const opts = { enabled: !disabled }
  useHotkeys("equal, shift+equal, add", () => zoomIn(), opts)
  useHotkeys("minus, subtract", () => zoomOut(), opts)
  useHotkeys("0", () => resetTransform(), opts)

  return (
    <>
      <Button
        size="icon-sm"
        variant="ghost"
        disabled={disabled}
        onClick={() => zoomOut()}
        title="Zoom out (−)"
      >
        <ZoomOut />
      </Button>
      <span className="w-12 text-center text-xs text-muted-foreground tabular-nums">
        {Math.round(scale * 100)}%
      </span>
      <Button
        size="icon-sm"
        variant="ghost"
        disabled={disabled}
        onClick={() => zoomIn()}
        title="Zoom in (+)"
      >
        <ZoomIn />
      </Button>
      <Button
        size="icon-sm"
        variant="ghost"
        disabled={disabled}
        onClick={() => resetTransform()}
        title="Reset view (0)"
      >
        <Maximize2 />
      </Button>
    </>
  )
}
