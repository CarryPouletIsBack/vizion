import { useEffect, useRef } from 'react'
import Highcharts from 'highcharts'
import HighchartsMore from 'highcharts/highcharts-more.js'
import SolidGauge from 'highcharts/modules/solid-gauge.js'

import './PhysioGauge.css'

// Initialiser les modules Highcharts nécessaires (pattern similaire à SingleCourseHeatmap)
let modulesReady = false
if (!modulesReady) {
  const moreFactory =
    (HighchartsMore as unknown as { default?: (H: typeof Highcharts) => void }).default ??
    (HighchartsMore as unknown as (H: typeof Highcharts) => void)

  if (typeof moreFactory === 'function') {
    moreFactory(Highcharts)
  } else {
    console.warn('HighchartsMore module introuvable ou invalide')
  }

  const gaugeFactory =
    (SolidGauge as unknown as { default?: (H: typeof Highcharts) => void }).default ??
    (SolidGauge as unknown as (H: typeof Highcharts) => void)

  if (typeof gaugeFactory === 'function') {
    gaugeFactory(Highcharts)
  } else {
    console.warn('SolidGauge module introuvable ou invalide')
  }
  modulesReady = true
}

// Données mockées pour le TSB (Training Stress Balance)
const MOCK_DATA = {
  tsb: 15, // Valeur positive = Fraîcheur, négative = Fatigue
}

type PhysioGaugeProps = {
  tsb?: number
}

export default function PhysioGauge({ tsb = MOCK_DATA.tsb }: PhysioGaugeProps) {
  const ref = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!ref.current) return

    const chart = Highcharts.chart(ref.current, {
      chart: {
        type: 'solidgauge',
        backgroundColor: 'transparent',
        height: 200,
      },
      title: {
        text: undefined,
      },
      credits: {
        enabled: false,
      },
      pane: {
        center: ['50%', '75%'],
        size: '100%',
        startAngle: -90,
        endAngle: 90,
        background: [
          {
            backgroundColor: 'transparent',
            innerRadius: '60%',
            outerRadius: '100%',
            shape: 'arc',
          },
        ],
      },
      tooltip: {
        enabled: false,
      },
      yAxis: {
        min: -50,
        max: 50,
        stops: [
          [0.1, '#ef4444'], // Rouge pour fatigue (valeurs négatives)
          [0.5, '#f59e0b'], // Orange pour neutre
          [0.9, '#10b981'], // Vert pour fraîcheur (valeurs positives)
        ],
        lineWidth: 0,
        tickWidth: 0,
        minorTickInterval: undefined,
        tickAmount: 2,
        title: {
          y: -70,
          text: 'TSB',
          style: {
            color: '#9ca3af',
          },
        },
        labels: {
          y: 16,
          style: {
            color: '#9ca3af',
          },
        },
      },
      plotOptions: {
        solidgauge: {
          dataLabels: {
            y: 5,
            borderWidth: 0,
            useHTML: true,
            format: '<div style="text-align:center"><span style="font-size:24px;color:{point.color}">{point.y}</span></div>',
          },
        },
      },
      series: [
        {
          name: 'TSB',
          data: [
            {
              color: tsb >= 0 ? '#10b981' : '#ef4444',
              radius: '100%',
              innerRadius: '60%',
              y: tsb,
            },
          ],
          dataLabels: {
            format: '<div style="text-align:center"><span style="font-size:24px;color:{point.color}">{point.y}</span></div>',
          },
        },
      ],
    })

    return () => chart.destroy()
  }, [tsb])

  return <div ref={ref} className="physio-gauge" aria-label="Training Stress Balance" />
}
