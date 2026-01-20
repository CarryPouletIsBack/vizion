import { useEffect, useRef, useState } from 'react'
import Highcharts from 'highcharts'
import HighchartsMore from 'highcharts/highcharts-more.js'
import SolidGauge from 'highcharts/modules/solid-gauge.js'
import { HiQuestionMarkCircle } from 'react-icons/hi'

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
  const [showInfo, setShowInfo] = useState(false)

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

  return (
    <div className="physio-gauge-wrapper">
      <div className="physio-gauge-header">
        <h3 className="physio-gauge-title">TSB</h3>
        <button
          type="button"
          className="physio-gauge-info-button"
          onClick={() => setShowInfo(!showInfo)}
          aria-label="Informations sur le TSB"
        >
          <HiQuestionMarkCircle />
        </button>
      </div>
      {showInfo && (
        <div className="physio-gauge-info">
          <p className="physio-gauge-info__title">Training Stress Balance (TSB)</p>
          <p className="physio-gauge-info__text">
            Le TSB mesure l'équilibre entre votre charge d'entraînement chronique (CTL) et votre charge aiguë (ATL).
          </p>
          <ul className="physio-gauge-info__list">
            <li><strong>TSB positif (vert)</strong> : Vous êtes frais, prêt pour une performance optimale</li>
            <li><strong>TSB proche de 0 (orange)</strong> : Équilibre, bonne forme générale</li>
            <li><strong>TSB négatif (rouge)</strong> : Fatigue accumulée, période de récupération recommandée</li>
          </ul>
          <p className="physio-gauge-info__note">
            Calculé à partir de vos activités Strava des 6 dernières semaines.
          </p>
        </div>
      )}
      <div ref={ref} className="physio-gauge" aria-label="Training Stress Balance" />
    </div>
  )
}
