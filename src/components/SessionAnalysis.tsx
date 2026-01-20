import './SessionAnalysis.css'
import { useEffect, useRef } from 'react'
import Highcharts from 'highcharts'
import HighchartsMore from 'highcharts/highcharts-more.js'
import SolidGauge from 'highcharts/modules/solid-gauge.js'
import type { StravaMetrics } from '../types/strava'
import { estimateTrailTime, calculateBasePaceFromMetrics } from '../lib/trailTimeEstimator'

// Initialiser les modules Highcharts nécessaires
let modulesReady = false
if (!modulesReady) {
  const moreFactory =
    (HighchartsMore as unknown as { default?: (H: typeof Highcharts) => void }).default ??
    (HighchartsMore as unknown as (H: typeof Highcharts) => void)

  if (typeof moreFactory === 'function') {
    moreFactory(Highcharts)
  }

  const gaugeFactory =
    (SolidGauge as unknown as { default?: (H: typeof Highcharts) => void }).default ??
    (SolidGauge as unknown as (H: typeof Highcharts) => void)

  if (typeof gaugeFactory === 'function') {
    gaugeFactory(Highcharts)
  }
  modulesReady = true
}

type SessionAnalysisProps = {
  courseName?: string
  courseDistanceKm?: number
  courseElevationGain?: number
  metrics?: StravaMetrics | null
}

// Convertir minutes en format "X'YY''"
function formatPace(minutes: number): string {
  const mins = Math.floor(minutes)
  const secs = Math.round((minutes - mins) * 60)
  return `${mins}'${secs.toString().padStart(2, '0')}''`
}

// Convertir heures en format "X'YY''" pour le temps total
function formatTime(hours: number): string {
  const totalMinutes = Math.round(hours * 60)
  const mins = Math.floor(totalMinutes)
  const secs = totalMinutes % 60
  return `${mins}'${secs.toString().padStart(2, '0')}''`
}

export default function SessionAnalysis({
  courseName = 'Cette course',
  courseDistanceKm = 0,
  courseElevationGain = 0,
  metrics = null,
}: SessionAnalysisProps) {
  // Calculer l'allure de base du coureur
  const basePaceMinPerKm = calculateBasePaceFromMetrics(metrics)
  
  // Estimer le temps pour cette course
  const timeEstimate = estimateTrailTime(
    {
      distanceKm: courseDistanceKm,
      elevationGain: courseElevationGain,
      basePaceMinPerKm,
    },
    metrics
  )

  // Allure recommandée pour cette course (allure finale estimée)
  const recommendedPace = formatPace(timeEstimate.finalPace)
  
  // Allure actuelle du coureur (basée sur ses métriques)
  const currentPace = formatPace(basePaceMinPerKm)
  
  // Plage d'allure recommandée (±5% autour de l'allure recommandée)
  const recommendedPaceSeconds = timeEstimate.finalPace * 60
  const paceRangeMin = formatPace((recommendedPaceSeconds * 0.95) / 60)
  const paceRangeMax = formatPace((recommendedPaceSeconds * 1.05) / 60)

  // Temps estimé pour la course
  const estimatedTime = formatTime(timeEstimate.totalHours)
  
  // Objectifs : comparer avec les capacités du coureur
  const achievements = {
    success: 0,
    total: 3,
  }
  
  // Objectif 1 : Distance (le coureur peut-il faire cette distance ?)
  const canCompleteDistance = metrics 
    ? metrics.longRunDistanceKm >= courseDistanceKm * 0.6 || metrics.kmPerWeek >= courseDistanceKm * 0.5
    : false
  
  // Objectif 2 : Dénivelé (le coureur peut-il gérer ce dénivelé ?)
  const canCompleteElevation = metrics
    ? metrics.longRunDPlus >= courseElevationGain * 0.6 || metrics.dPlusPerWeek >= courseElevationGain * 0.5
    : false
  
  // Objectif 3 : Allure (le coureur peut-il maintenir l'allure recommandée ?)
  const canMaintainPace = basePaceMinPerKm <= timeEstimate.finalPace * 1.1
  
  if (canCompleteDistance) achievements.success++
  if (canCompleteElevation) achievements.success++
  if (canMaintainPace) achievements.success++

  // Utiliser l'allure actuelle comme "allure réalisée" pour la comparaison
  const achievedPace = currentPace
  
  // Plage d'allure pour le gauge
  const paceRange = {
    min: paceRangeMin,
    max: paceRangeMax,
  }
  
  const gaugeRef = useRef<HTMLDivElement | null>(null)

  // Convertir les allures en valeurs numériques pour le gauge
  const paceToSeconds = (pace: string) => {
    const match = pace.match(/(\d+)'(\d+)''/)
    if (!match) return 0
    return parseInt(match[1]) * 60 + parseInt(match[2])
  }

  const minPaceSeconds = paceToSeconds(paceRange.max) // Plus lent = plus de secondes
  const maxPaceSeconds = paceToSeconds(paceRange.min) // Plus rapide = moins de secondes
  const achievedPaceSeconds = paceToSeconds(achievedPace)

  // Normaliser la valeur pour le gauge (0-100)
  // Plus rapide (moins de secondes) = valeur plus élevée sur le gauge
  const gaugeValue = maxPaceSeconds > minPaceSeconds
    ? Math.max(0, Math.min(100, ((maxPaceSeconds - achievedPaceSeconds) / (maxPaceSeconds - minPaceSeconds)) * 100))
    : 50

  // Calculer le pourcentage pour le slider
  const pacePercentage = maxPaceSeconds > minPaceSeconds
    ? Math.max(0, Math.min(1, (maxPaceSeconds - achievedPaceSeconds) / (maxPaceSeconds - minPaceSeconds)))
    : 0.5

  useEffect(() => {
    if (!gaugeRef.current) return

    const chart = Highcharts.chart(gaugeRef.current, {
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
        min: 0,
        max: 100,
        stops: [
          [0, '#8b5cf6'], // Violet pour la plage recommandée
          [1, '#8b5cf6'],
        ],
        lineWidth: 0,
        tickWidth: 0,
        minorTickInterval: undefined,
        tickAmount: 0,
        labels: {
          enabled: false,
        },
      },
      plotOptions: {
        solidgauge: {
          dataLabels: {
            enabled: false,
          },
        },
      },
      series: [
        {
          name: 'Allure',
          data: [
            {
              color: '#8b5cf6',
              radius: '100%',
              innerRadius: '60%',
              y: gaugeValue,
            },
          ],
        },
      ],
    })

    return () => chart.destroy()
  }, [gaugeValue])

  return (
    <div className="session-analysis">
      <h3 className="session-analysis__title">Analyse de mon allure pour cette course</h3>

      {/* Gauge d'allure */}
      <div className="session-analysis__gauge">
        <div className="session-analysis__gauge-value">{achievedPace}</div>
        <div className="session-analysis__gauge-recommended">
          Allure recommandée pour cette course : {recommendedPace}
        </div>
        <div className="session-analysis__gauge-arc">
          <div ref={gaugeRef} className="session-analysis__gauge-chart" />
          <div className="session-analysis__gauge-labels">
            <span className="session-analysis__gauge-label session-analysis__gauge-label--left">
              {paceRange.max}
            </span>
            <span className="session-analysis__gauge-label session-analysis__gauge-label--right">
              {paceRange.min}
            </span>
          </div>
        </div>
      </div>

      {/* Analyse détaillée */}
      <div className="session-analysis__section">
        <h4 className="session-analysis__section-title">Analyse détaillée</h4>
        <div className="session-analysis__legend">
          <div className="session-analysis__legend-item">
            <div className="session-analysis__legend-icon session-analysis__legend-icon--circle" />
            <span>Allure réalisée</span>
          </div>
          <div className="session-analysis__legend-item">
            <div className="session-analysis__legend-icon session-analysis__legend-icon--square" />
            <span>Allure recommandée</span>
          </div>
        </div>
      </div>

      {/* Coeur de séance */}
      <div className="session-analysis__section">
        <div className="session-analysis__section-header">
          <h4 className="session-analysis__section-title">Coeur de séance</h4>
          <div className="session-analysis__achievements">
            {achievements.success > 0 ? (
              <span className="session-analysis__achievements-success">✓</span>
            ) : (
              <span className="session-analysis__achievements-fail">✗</span>
            )}
            <span>{achievements.success}/{achievements.total} réussis</span>
          </div>
        </div>

        <div className="session-analysis__metrics">
          {/* Temps */}
          <div className="session-analysis__metric">
            <div className="session-analysis__metric-label">Temps estimé</div>
            <div className="session-analysis__metric-value">
              {canMaintainPace ? (
                <span className="session-analysis__metric-success">✓</span>
              ) : (
                <span className="session-analysis__metric-fail">✗</span>
              )}
              <span>{estimatedTime}</span>
            </div>
          </div>

          {/* Allures */}
          <div className="session-analysis__metric">
            <div className="session-analysis__metric-label">Allures (min/km)</div>
            <div className="session-analysis__metric-value">{achievedPace}</div>
            <div className="session-analysis__pace-slider">
              <div className="session-analysis__pace-slider-track">
                <div
                  className="session-analysis__pace-slider-fill"
                  style={{ width: `${Math.min(100, Math.max(0, pacePercentage * 100))}%` }}
                />
                <div
                  className="session-analysis__pace-slider-handle"
                  style={{ left: `${Math.min(100, Math.max(0, pacePercentage * 100))}%` }}
                />
              </div>
            </div>
          </div>

          {/* Distance */}
          <div className="session-analysis__metric">
            <div className="session-analysis__metric-label">Distance</div>
            <div className="session-analysis__metric-value">
              {canCompleteDistance ? (
                <span className="session-analysis__metric-success">✓</span>
              ) : (
                <span className="session-analysis__metric-fail">✗</span>
              )}
              <span>{(courseDistanceKm * 1000).toLocaleString('fr-FR')} m</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
