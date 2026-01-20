import { useEffect, useRef } from 'react'
import Highcharts from 'highcharts'

import './RaceStrategy.css'
import { grandRaidStats, type CheckpointTime } from '../data/grandRaidStats'

// Données mockées pour le profil altimétrique
const MOCK_PROFILE_DATA: Array<[number, number]> = [
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

// Fonction pour convertir des heures décimales en format HH:MM
function formatHoursToTime(hours: number): string {
  const h = Math.floor(hours)
  const m = Math.round((hours - h) * 60)
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`
}

// Générer des barrières basées sur les checkpoints du Grand Raid si disponibles
function generateBarriersFromCheckpoints(
  checkpoints: CheckpointTime[],
  courseName?: string
): Array<{ name: string; distance: number; timeLimit: string }> {
  // Utiliser les checkpoints du Grand Raid si c'est cette course
  const isGrandRaid = courseName?.toLowerCase().includes('grand raid') || 
                      courseName?.toLowerCase().includes('diagonale')
  
  if (isGrandRaid && checkpoints.length > 0) {
    // Utiliser les temps moyens comme barrières (plus réalistes que les élites)
    return checkpoints
      .filter((cp) => cp.distanceKm > 0) // Exclure le départ
      .map((cp) => ({
        name: cp.name,
        distance: cp.distanceKm,
        // Utiliser le temps moyen + 20% de marge pour les barrières
        timeLimit: formatHoursToTime(cp.times.average * 1.2),
      }))
      .slice(0, 10) // Limiter à 10 barrières pour la lisibilité
  }
  
  // Barrières par défaut pour les autres courses
  return [
    {
      name: 'Ravito 1',
      distance: 15,
      timeLimit: '08:00',
    },
    {
      name: 'Ravito 2',
      distance: 35,
      timeLimit: '14:00',
    },
    {
      name: 'Ravito 3',
      distance: 55,
      timeLimit: '20:00',
    },
  ]
}

type Barrier = {
  name: string
  distance: number
  timeLimit: string
}

type RaceStrategyProps = {
  profileData?: Array<[number, number]>
  barriers?: Barrier[]
  courseName?: string
}

export default function RaceStrategy({
  profileData = MOCK_PROFILE_DATA,
  barriers,
  courseName,
}: RaceStrategyProps) {
  // Générer les barrières depuis les checkpoints si non fournies
  const effectiveBarriers = barriers || generateBarriersFromCheckpoints(
    grandRaidStats.checkpoints || [],
    courseName
  )
  const ref = useRef<HTMLDivElement | null>(null)

  // S'assurer que profileData est valide
  const isValidData = Array.isArray(profileData) && profileData.length > 1
  const seriesData = isValidData ? profileData : MOCK_PROFILE_DATA

  // Calculer les valeurs min/max pour l'axe Y
  const allYValues = seriesData.map((p) => p[1])
  const minY = allYValues.length > 0 ? Math.min(...allYValues) : 0
  const maxY = allYValues.length > 0 ? Math.max(...allYValues) : 1000

  useEffect(() => {
    if (!ref.current) return

    // Créer les plotLines pour les barrières horaires
    const plotLines = effectiveBarriers.map((barrier) => ({
      value: barrier.distance,
      color: '#ef4444',
      width: 2,
      dashStyle: 'Dash' as const,
      label: {
        text: `${barrier.name}<br/>${barrier.timeLimit}`,
        align: 'right' as const,
        style: {
          color: '#ef4444',
          fontWeight: 'bold',
        },
        x: -10,
      },
      zIndex: 5,
    }))

    const chart = Highcharts.chart(ref.current, {
      chart: {
        type: 'areaspline',
        backgroundColor: 'transparent',
        height: 300,
        margin: [10, 10, 25, 40],
      },
      title: {
        text: undefined,
      },
      credits: {
        enabled: false,
      },
      legend: {
        enabled: false,
      },
      xAxis: {
        title: {
          text: 'Distance (km)',
          style: {
            color: '#9ca3af',
          },
        },
        labels: {
          style: {
            color: '#9ca3af',
          },
          formatter: function() {
            return Math.round(this.value as number).toString()
          },
        },
        gridLineWidth: 0,
        lineColor: 'rgba(255,255,255,0.2)',
        plotLines: plotLines,
      },
      yAxis: {
        title: {
          text: 'Altitude (m)',
          style: {
            color: '#9ca3af',
          },
        },
        labels: {
          style: {
            color: '#9ca3af',
          },
          formatter: function() {
            return Math.round(this.value as number).toString()
          },
        },
        gridLineColor: 'rgba(255,255,255,0.15)',
        tickAmount: 6,
        min: minY - 20,
        max: maxY + 20,
      },
      tooltip: {
        backgroundColor: '#0b0e11',
        borderColor: '#2a3038',
        style: {
          color: '#e5e7eb',
        },
        valueSuffix: ' m',
        headerFormat: '<b>{point.key} km</b><br/>',
        pointFormatter: function() {
          return `<span style="color:${this.color}">●</span> Altitude: <b>${Math.round(this.y as number)} m</b><br/>`
        },
      },
      plotOptions: {
        areaspline: {
          fillOpacity: 0.3,
          lineWidth: 2,
          marker: {
            enabled: false,
          },
        },
      },
      series: [
        {
          name: 'Profil altimétrique',
          data: seriesData,
          color: '#bfc900',
        },
      ],
    })

    return () => chart.destroy()
  }, [seriesData, effectiveBarriers, minY, maxY])

  return <div ref={ref} className="race-strategy" aria-label="Profil et Barrières Horaires" />
}
