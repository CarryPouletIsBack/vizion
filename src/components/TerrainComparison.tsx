import { useEffect, useRef } from 'react'
import Highcharts from 'highcharts'

import './TerrainComparison.css'

// Données mockées pour le Volume/Objectif
const MOCK_DATA = {
  elevationGain: {
    current: 8500, // mètres actuels
    target: 10150, // mètres objectif
  },
  elevationLoss: {
    current: 12000, // mètres actuels
    target: 15000, // mètres objectif
  },
}

type TerrainComparisonProps = {
  elevationGain?: { current: number; target: number }
  elevationLoss?: { current: number; target: number }
}

export default function TerrainComparison({
  elevationGain = MOCK_DATA.elevationGain,
  elevationLoss = MOCK_DATA.elevationLoss,
}: TerrainComparisonProps) {
  const ref = useRef<HTMLDivElement | null>(null)

  // Calculer les pourcentages d'avancement
  const gainPercent = elevationGain.target > 0 ? (elevationGain.current / elevationGain.target) * 100 : 0
  const lossPercent = elevationLoss.target > 0 ? (elevationLoss.current / elevationLoss.target) * 100 : 0

  useEffect(() => {
    if (!ref.current) return

    const chart = Highcharts.chart(ref.current, {
      accessibility: { enabled: false },
      chart: {
        type: 'bar',
        backgroundColor: 'transparent',
        height: 200,
        inverted: true,
      },
      title: {
        text: undefined,
      },
      credits: {
        enabled: false,
      },
      xAxis: {
        categories: ['D+', 'D-'],
        labels: {
          style: {
            color: '#9ca3af',
          },
        },
        lineColor: 'rgba(255,255,255,0.2)',
      },
      yAxis: {
        min: 0,
        max: 100,
        title: {
          text: '%',
          style: {
            color: '#9ca3af',
          },
        },
        labels: {
          style: {
            color: '#9ca3af',
          },
          formatter: function() {
            return `${Math.round(this.value as number)}%`
          },
        },
        gridLineColor: 'rgba(255,255,255,0.15)',
      },
      legend: {
        enabled: false,
      },
      tooltip: {
        backgroundColor: '#0b0e11',
        borderColor: '#2a3038',
        style: {
          color: '#e5e7eb',
        },
        formatter: function() {
          const category = String(this.x)
          const percent = Math.round(this.y as number)
          if (category === 'D+') {
            return `<b>D+</b><br/>Actuel: ${elevationGain.current.toLocaleString('fr-FR')} m<br/>Objectif: ${elevationGain.target.toLocaleString('fr-FR')} m<br/>Avancement: <b>${percent}%</b>`
          } else {
            return `<b>D-</b><br/>Actuel: ${elevationLoss.current.toLocaleString('fr-FR')} m<br/>Objectif: ${elevationLoss.target.toLocaleString('fr-FR')} m<br/>Avancement: <b>${percent}%</b>`
          }
        },
      },
      plotOptions: {
        bar: {
          dataLabels: {
            enabled: true,
            style: {
              color: '#e5e7eb',
            },
            formatter: function() {
              const category = String(this.x)
              const percent = Math.round(this.y as number)
              if (category === 'D+') {
                return `${elevationGain.current.toLocaleString('fr-FR')} m (${percent}%)`
              } else {
                return `${elevationLoss.current.toLocaleString('fr-FR')} m (${percent}%)`
              }
            },
          },
        },
      },
      series: [
        {
          name: 'Avancement',
          data: [
            {
              y: gainPercent,
              color: '#bfc900',
            },
            {
              y: lossPercent,
              color: '#bfc900',
            },
          ],
        },
      ],
    })

    return () => chart.destroy()
  }, [elevationGain, elevationLoss, gainPercent, lossPercent])

  return <div ref={ref} className="terrain-comparison" aria-label="Comparaison Volume/Objectif" />
}
