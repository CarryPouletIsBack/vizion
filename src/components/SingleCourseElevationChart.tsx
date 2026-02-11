import { useEffect, useMemo, useRef } from 'react'
import Highcharts from 'highcharts'

import './SingleCourseElevationChart.css'
import { estimateRunnerElevationLine } from '../lib/runnerEstimate'
import type { StravaMetrics } from '../types/strava'
const SERIES_COLOR = '#ffe500'
const RUNNER_ESTIMATE_COLOR = '#bfc900'

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
  metrics?: StravaMetrics | null
  /** Hauteur du graphique en px (défaut 200). À passer pour la version compacte afin que les axes restent visibles. */
  height?: number
}

export default function SingleCourseElevationChart({ data, metrics, height: chartHeight = 200 }: SingleCourseElevationChartProps) {
  const ref = useRef<HTMLDivElement | null>(null)

  const seriesData = useMemo(() => {
    const isValid = Array.isArray(data) && data.length > 1
    return isValid ? data.map(([x, y]) => [x, y]) : sampleData.map(([x, y]) => [x, y])
  }, [data])

  const runnerEstimateData = useMemo((): Array<[number, number]> => {
    if (!(Array.isArray(seriesData) && seriesData.length > 1) || !metrics) return []
    return estimateRunnerElevationLine(seriesData as Array<[number, number]>, metrics)
  }, [seriesData, metrics])

  const allYValues = [
    ...seriesData.map((p) => p[1]),
    ...(runnerEstimateData.length > 0 ? runnerEstimateData.map((p) => p[1]) : []),
  ]
  const minY = allYValues.length > 0 ? Math.min(...allYValues) : 0
  const maxY = allYValues.length > 0 ? Math.max(...allYValues) : 1000
  const totalDistance = seriesData[seriesData.length - 1][0]

  useEffect(() => {
    if (!ref.current) return
    const chart = Highcharts.chart(ref.current, {
      accessibility: { enabled: false },
      chart: {
        backgroundColor: 'transparent',
        height: chartHeight,
        margin: [10, 10, 25, 40],
        animation: {
          duration: 900,
        },
      },
      title: { text: undefined },
      credits: { enabled: false },
      legend: {
        enabled: runnerEstimateData.length > 0,
        itemStyle: { color: '#9ca3af' },
        align: 'right',
        verticalAlign: 'top',
      },
      xAxis: {
        title: { text: 'Km', style: { color: '#9ca3af', fontSize: '11px' } },
        labels: {
          style: { color: '#9ca3af', fontSize: '10px' },
          formatter: function() {
            return Math.round(this.value as number).toString()
          }
        },
        gridLineWidth: 0,
        lineColor: 'rgba(255,255,255,0.2)',
      },
      yAxis: {
        title: { text: 'D+', style: { color: '#9ca3af', fontSize: '11px' } },
        labels: {
          style: { color: '#9ca3af', fontSize: '10px' },
          formatter: function() {
            return Math.round(this.value as number).toString()
          }
        },
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
        pointFormatter: function() {
          return `<span style="color:${this.color}">●</span> ${this.series.name}: <b>${Math.round(this.y as number)} m</b><br/>`
        },
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
          name: 'Profil course',
          data: seriesData,
          color: SERIES_COLOR,
        },
        ...(runnerEstimateData.length > 0
          ? [
              {
                type: 'line',
                name: 'Estimation coureur',
                data: runnerEstimateData,
                color: RUNNER_ESTIMATE_COLOR,
                dashStyle: 'Dash',
                lineWidth: 2,
                marker: { enabled: false },
              } as Highcharts.SeriesLineOptions,
            ]
          : []),
      ],
    })

    return () => chart.destroy()
  }, [seriesData, runnerEstimateData, chartHeight])

  return (
    <div
      ref={ref}
      className="single-course-elevation-chart"
      aria-label="Dénivelé"
      style={{ height: chartHeight }}
    />
  )
}
