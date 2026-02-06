import { useEffect, useRef } from 'react'
// Même instance ESM pour que more + solid-gauge s’enregistrent correctement
import Highcharts from 'highcharts/esm/highcharts'
import 'highcharts/esm/highcharts-more'
import 'highcharts/esm/modules/solid-gauge'

import './PhysioGauge.css'

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
      accessibility: { enabled: false },
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
