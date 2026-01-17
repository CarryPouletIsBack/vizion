import { useEffect, useMemo, useRef } from 'react'
import Highcharts from 'highcharts'
import HeatmapModule from 'highcharts/modules/heatmap.js'

import './SingleCourseHeatmap.css'

let heatmapReady = false
if (!heatmapReady) {
  const heatmapFactory =
    (HeatmapModule as unknown as { default?: (H: typeof Highcharts) => void }).default ??
    (HeatmapModule as unknown as (H: typeof Highcharts) => void)

  if (typeof heatmapFactory === 'function') {
    heatmapFactory(Highcharts)
  } else {
    // Sécurité : ne pas bloquer si module mal résolu
    console.warn('Heatmap module introuvable ou invalide')
  }
  heatmapReady = true
}

const DAY_MS = 24 * 36e5

const buildHeatmapData = () => {
  const today = new Date()
  const end = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate())
  const start = end - DAY_MS * 42
  const data: Array<[number, number, number]> = []

  for (let time = start; time <= end; time += DAY_MS) {
    const dayIndex = Math.floor((time - start) / DAY_MS)
    const value = Math.round(200 + 400 * (Math.sin(dayIndex / 3) + 1) + 120 * (dayIndex % 5))
    data.push([time, 0, Math.min(value, 1000)])
  }

  return { data, start, end }
}

export default function SingleCourseHeatmap() {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const { data, start, end } = useMemo(() => buildHeatmapData(), [])

  useEffect(() => {
    if (!containerRef.current) return

    const chart = Highcharts.chart(containerRef.current, {
      chart: {
        type: 'heatmap',
        backgroundColor: 'transparent',
        height: 140,
        spacing: [0, 0, 0, 0],
      },
      title: undefined,
      credits: { enabled: false },
      legend: { enabled: false },
      xAxis: {
        type: 'datetime',
        min: start,
        max: end,
        tickInterval: DAY_MS * 30,
        labels: {
          style: { color: '#9ca3af', fontSize: '12px' },
          format: '{value:%b}',
        },
        lineWidth: 0,
        tickWidth: 0,
      },
      yAxis: {
        visible: false,
        min: 0,
        max: 0,
      },
      colorAxis: {
        min: 0,
        max: 1000,
        minColor: '#26272b',
        maxColor: '#079455',
        stops: [
          [0, '#26272b'],
          [0.35, 'rgba(23, 178, 106, 0.4)'],
          [0.65, '#75e0a7'],
          [1, '#079455'],
        ],
      },
      tooltip: {
        backgroundColor: '#101418',
        borderColor: '#2a3038',
        style: { color: '#e5e7eb' },
        pointFormat:
          '<span style="color:{point.color}">\u25CF</span> {point.date:%e %b %Y}: <b>{point.value}</b>',
      },
      plotOptions: {
        series: {
          borderColor: '#3f3f46',
          borderWidth: 0.5,
        },
      },
      series: [
        {
          type: 'heatmap',
          data,
          colorKey: 'value',
          pointPadding: 0.1,
          colsize: DAY_MS,
          dataLabels: {
            enabled: false,
          },
        },
      ],
    })

    return () => {
      chart.destroy()
    }
  }, [data, start, end])

  return <div ref={containerRef} className="single-course-heatmap" aria-label="Heatmap charge" />
}
