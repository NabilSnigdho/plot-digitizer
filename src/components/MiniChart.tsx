import { useMemo } from "react"
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
import type { AxisScale, Row } from "../types"
import { C } from "../constants"
import { fmt } from "../lib/format"

export function MiniChart({
  rows,
  xLabel,
  yLabel,
  xScale,
  yScale,
}: {
  rows: Row[]
  xLabel: string
  yLabel: string
  xScale: AxisScale
  yScale: AxisScale
}) {
  const data = useMemo(() => rows.map(([x, y]) => ({ x, y })), [rows])
  const config = {
    y: { label: yLabel || "y", color: C.curve },
  } satisfies ChartConfig

  return (
    <ChartContainer config={config} className="aspect-auto h-44 w-full">
      <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid vertical={false} />
        <XAxis
          dataKey="x"
          type="number"
          scale={xScale}
          domain={["dataMin", "dataMax"]}
          tickFormatter={fmt}
          tickLine={false}
          axisLine={false}
          minTickGap={24}
        />
        <YAxis
          type="number"
          scale={yScale}
          domain={["auto", "auto"]}
          tickFormatter={fmt}
          tickLine={false}
          axisLine={false}
          width={44}
        />
        <ChartTooltip
          content={
            <ChartTooltipContent
              labelFormatter={(_, payload) =>
                `${xLabel || "x"}: ${fmt(Number(payload[0]?.payload.x))}`
              }
              formatter={(value) => (
                <span className="font-mono tabular-nums">
                  {yLabel || "y"}: {fmt(Number(value))}
                </span>
              )}
            />
          }
        />
        <Area
          dataKey="y"
          type="linear"
          baseValue="dataMin"
          stroke="var(--color-y)"
          strokeWidth={2}
          fill="var(--color-y)"
          fillOpacity={0.12}
          dot={false}
          isAnimationActive={false}
        />
      </AreaChart>
    </ChartContainer>
  )
}
