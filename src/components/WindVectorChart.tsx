import { useEffect, useRef } from 'react'
import Highcharts from 'highcharts'
import VectorModule from 'highcharts/modules/vector.js'

import './WindVectorChart.css'

let vectorReady = false
if (!vectorReady) {
  const factory =
    (VectorModule as unknown as { default?: (H: typeof Highcharts) => void }).default ??
    (VectorModule as unknown as (H: typeof Highcharts) => void)
  if (typeof factory === 'function') factory(Highcharts)
  vectorReady = true
}

const WIND_DIR_DEG: Record<string, number> = {
  N: 0, NNE: 22.5, NE: 45, ENE: 67.5, E: 90, ESE: 112.5, SE: 135, SSE: 157.5,
  S: 180, SSW: 202.5, SW: 225, WSW: 247.5, W: 270, WNW: 292.5, NW: 315, NNW: 337.5,
}

export type WindVectorChartProps = {
  /** viewBox du SVG du segment (minX minY width height) pour aligner les axes */
  viewBox: string
  /** Direction du vent (cardinal, ex. NNE) */
  windDir: string | null
  /** Vitesse du vent en km/h */
  windSpeedKmh: number | null
}

function parseViewBox(viewBox: string): { minX: number; minY: number; width: number; height: number } | null {
  const parts = viewBox.trim().split(/\s+/).map(Number)
  if (parts.length !== 4 || parts.some(Number.isNaN)) return null
  return { minX: parts[0], minY: parts[1], width: parts[2], height: parts[3] }
}

export default function WindVectorChart({ viewBox, windDir, windSpeedKmh }: WindVectorChartProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!containerRef.current || !windDir) return
    const vb = parseViewBox(viewBox)
    if (!vb) return

    const { minX, minY, width, height } = vb
    const deg = WIND_DIR_DEG[windDir] ?? 0
    const length = windSpeedKmh != null && windSpeedKmh > 0 ? Math.min(1, windSpeedKmh / 30) : 0.5
    const margin = 0.08
    const zoneStart = margin
    const zoneEnd = 1 - margin
    const gridRows = 15
    const gridCols = 15
    const vectorData: [number, number, number, number][] = []
    for (let row = 0; row < gridRows; row++) {
      for (let col = 0; col < gridCols; col++) {
        const tx = zoneStart + (zoneEnd - zoneStart) * (gridCols <= 1 ? 0.5 : col / (gridCols - 1))
        const ty = zoneStart + (zoneEnd - zoneStart) * (gridRows <= 1 ? 0.5 : row / (gridRows - 1))
        vectorData.push([minX + width * tx, minY + height * ty, length, deg])
      }
    }

    const chart = Highcharts.chart(containerRef.current, {
      chart: {
        type: 'vector',
        backgroundColor: 'transparent',
        margin: 0,
        spacing: 0,
      },
      title: { text: undefined },
      legend: { enabled: false },
      credits: { enabled: false },
      xAxis: {
        min: minX,
        max: minX + width,
        visible: false,
        startOnTick: false,
        endOnTick: false,
      },
      yAxis: {
        min: minY,
        max: minY + height,
        reversed: true,
        visible: false,
        startOnTick: false,
        endOnTick: false,
      },
      plotOptions: {
        vector: {
          vectorLength: 18,
          rotationOrigin: 'start',
        },
      },
      series: [{
        type: 'vector',
        data: vectorData,
        color: '#bfc900',
      }],
    })

    return () => {
      chart.destroy()
    }
  }, [viewBox, windDir, windSpeedKmh])

  if (!windDir) return null

  return (
    <div
      className="wind-vector-chart"
      ref={containerRef}
      aria-hidden
    />
  )
}
