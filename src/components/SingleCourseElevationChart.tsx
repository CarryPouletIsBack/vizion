import { useEffect, useRef } from 'react'
import Highcharts from 'highcharts'

import './SingleCourseElevationChart.css'

const SERIES_COLOR = '#ffe500'

const sampleData = [
  [0, 0],
  [5, 180],
  [12, 420],
  [18, 300],
  [25, 620],
  [33, 480],
  [40, 760],
  [48, 520],
  [55, 900],
  [63, 680],
  [70, 1050],
]

type SingleCourseElevationChartProps = {
  data?: Array<[number, number]>
}

export default function SingleCourseElevationChart({ data }: SingleCourseElevationChartProps) {
  const ref = useRef<HTMLDivElement | null>(null)
  
  // S'assurer que data est un tableau valide
  const isValidData = Array.isArray(data) && data.length > 1
  const seriesData = isValidData ? data.map(([x, y]) => [x, y]) : sampleData.map(([x, y]) => [x, y])
  
  const minY = Math.min(...seriesData.map((p) => p[1]))
  const maxY = Math.max(...seriesData.map((p) => p[1]))
  const totalDistance = seriesData[seriesData.length - 1][0]

  useEffect(() => {
    if (!ref.current) return
    const chart = Highcharts.chart(ref.current, {
      chart: {
        backgroundColor: 'transparent',
        height: 200,
        margin: [10, 10, 25, 40],
        animation: {
          duration: 900,
        },
      },
      title: { text: undefined },
      credits: { enabled: false },
      legend: { enabled: false },
      xAxis: {
        title: { text: 'Km', style: { color: '#9ca3af' } },
        labels: { style: { color: '#9ca3af' } },
        gridLineWidth: 0,
        lineColor: 'rgba(255,255,255,0.2)',
      },
      yAxis: {
        title: { text: 'D+', style: { color: '#9ca3af' } },
        labels: { style: { color: '#9ca3af' } },
        gridLineColor: 'rgba(255,255,255,0.15)',
        tickAmount: 6,
        min: minY - 20,
        max: maxY + 20,
      },
      tooltip: {
        backgroundColor: '#0b0e11',
        borderColor: '#2a3038',
        style: { color: '#e5e7eb' },
        valueSuffix: ' m',
        headerFormat: '<b>{point.key} km</b><br/>',
      },
      plotOptions: {
        series: {
          marker: { enabled: false },
          animation: { duration: 900 },
          point: {
            events: {
              mouseOver: function () {
                if (typeof window !== 'undefined' && window.dispatchEvent) {
                  window.dispatchEvent(
                    new CustomEvent('gpx-hover', {
                      detail: { distance: this.x, elevation: this.y, totalDistance },
                    }),
                  )
                }
              },
            },
          },
        },
        line: {
          lineWidth: 2,
        },
      },
      series: [
        {
          type: 'line',
          data: seriesData,
          color: SERIES_COLOR,
        },
      ],
    })

    return () => chart.destroy()
  }, [])

  return <div ref={ref} className="single-course-elevation-chart" aria-label="Dénivelé" />
}
