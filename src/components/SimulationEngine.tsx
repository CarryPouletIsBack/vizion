import { useState, useMemo } from 'react'
import { FiSettings, FiActivity, FiAlertCircle } from 'react-icons/fi'
import { IoMdStar } from 'react-icons/io'
import { FaTrophy, FaMedal, FaWalking, FaRunning } from 'react-icons/fa'
import { GiTurtle } from 'react-icons/gi'
import './SimulationEngine.css'
import { estimateTrailTime, type TimeEstimate } from '../lib/trailTimeEstimator'
import type { StravaMetrics } from '../types/strava'
import { grandRaidStats } from '../data/grandRaidStats'

type SimulationEngineProps = {
  distanceKm: number
  elevationGain: number
  metrics: StravaMetrics | null
  baseTimeEstimate?: TimeEstimate
}

type BarrierInfo = {
  name: string
  distanceKm: number
  cutoffHours: number
  estimatedArrivalHours: number
  marginHours: number
  isAtRisk: boolean
}

export default function SimulationEngine({
  distanceKm,
  elevationGain,
  metrics,
  baseTimeEstimate,
}: SimulationEngineProps) {
  const [fitnessLevel, setFitnessLevel] = useState(100) // 50-120%
  const [refuelTimePerStop, setRefuelTimePerStop] = useState(10) // minutes
  const [technicalIndex, setTechnicalIndex] = useState<'good' | 'average' | 'cautious'>('average')
  const [enduranceIndex, setEnduranceIndex] = useState<'elite' | 'experienced' | 'intermediate' | 'beginner'>('intermediate')

  // Calculer le nombre de ravitaillements (1 tous les 20 km environ)
  const refuelStops = Math.ceil(distanceKm / 20)

  // Recalculer le temps estimé en temps réel
  const timeEstimate = useMemo(() => {
    if (!baseTimeEstimate) return null

    // Calculer le nouveau temps basé sur les paramètres de simulation
    const newEstimate = estimateTrailTime(
      {
        distanceKm,
        elevationGain,
        basePaceMinPerKm: baseTimeEstimate.basePace,
        refuelStops,
        refuelTimePerStop,
        fitnessLevel,
        technicalIndex,
        enduranceIndex,
      },
      metrics
    )

    return newEstimate
  }, [distanceKm, elevationGain, baseTimeEstimate, refuelStops, refuelTimePerStop, fitnessLevel, technicalIndex, enduranceIndex, metrics])

  // Calculer les barrières horaires (basées sur les points d'abandon du Grand Raid)
  const barriers: BarrierInfo[] = useMemo(() => {
    if (!timeEstimate) return []

    // Utiliser les points d'abandon comme barrières horaires
    // Estimation : barrière à 80% du temps estimé pour chaque point critique
    return grandRaidStats.abandonPoints
      .filter((point) => point.distanceKm > 0 && point.distanceKm < distanceKm)
      .map((point) => {
        // Estimer l'heure de passage à ce point (proportionnel à la distance)
        const distanceRatio = point.distanceKm / distanceKm
        const estimatedArrivalHours = timeEstimate.totalHours * distanceRatio
        // Barrière horaire = 80% du temps estimé + marge de sécurité
        const cutoffHours = estimatedArrivalHours * 0.8
        const marginHours = cutoffHours - estimatedArrivalHours
        const isAtRisk = marginHours < 0.5 // Moins de 30 min de marge = risque

        return {
          name: point.name,
          distanceKm: point.distanceKm,
          cutoffHours,
          estimatedArrivalHours,
          marginHours,
          isAtRisk,
        }
      })
      .filter((b) => b.isAtRisk || b.marginHours < 2) // Afficher seulement les barrières à risque ou proches
      .sort((a, b) => a.distanceKm - b.distanceKm)
      .slice(0, 5) // Limiter à 5 barrières les plus critiques
  }, [timeEstimate, distanceKm])

  const formatTime = (hours: number): string => {
    const h = Math.floor(hours)
    const m = Math.round((hours - h) * 60)
    return `${h}h${m > 0 ? ` ${m}min` : ''}`
  }

  return (
    <div className="simulation-engine">
      <div className="simulation-engine__header">
        <h3 className="simulation-engine__title">
          <FiSettings style={{ display: 'inline', marginRight: '8px', verticalAlign: 'middle' }} />
          Moteur de Simulation
        </h3>
        <p className="simulation-engine__subtitle">Ajuste les paramètres pour affiner ton estimation</p>
      </div>

      {/* Slider État de forme */}
      <div className="simulation-engine__control">
        <label className="simulation-engine__label">
          <span>État de forme</span>
          <span className="simulation-engine__value">{fitnessLevel}%</span>
        </label>
        <input
          type="range"
          min="50"
          max="120"
          value={fitnessLevel}
          onChange={(e) => setFitnessLevel(Number(e.target.value))}
          className="simulation-engine__slider"
        />
        <div className="simulation-engine__hint">
          {fitnessLevel < 80 && 'Tu es en sous-forme, prévois un temps plus long'}
          {fitnessLevel >= 80 && fitnessLevel <= 100 && 'Forme normale'}
          {fitnessLevel > 100 && 'Tu es en super forme, tu peux viser plus ambitieux'}
        </div>
      </div>

      {/* Gestion des ravitaillements */}
      <div className="simulation-engine__control">
        <label className="simulation-engine__label">
          <span>Temps moyen par ravitaillement</span>
          <span className="simulation-engine__value">{refuelTimePerStop} min</span>
        </label>
        <input
          type="range"
          min="2"
          max="20"
          value={refuelTimePerStop}
          onChange={(e) => setRefuelTimePerStop(Number(e.target.value))}
          className="simulation-engine__slider"
        />
        <div className="simulation-engine__hint">
          {refuelStops} ravitaillement{refuelStops > 1 ? 's' : ''} prévu{refuelStops > 1 ? 's' : ''} ={' '}
          {refuelStops * refuelTimePerStop} min au total
        </div>
      </div>

      {/* Score d'Engagement (Technicité) */}
      <div className="simulation-engine__control">
        <label className="simulation-engine__label">Score d'Engagement (Technicité)</label>
        <div className="simulation-engine__radio-group">
          <button
            type="button"
            className={`simulation-engine__radio ${technicalIndex === 'good' ? 'simulation-engine__radio--active' : ''}`}
            onClick={() => setTechnicalIndex('good')}
          >
            <FaRunning style={{ marginRight: '4px' }} /> Bon descendeur
          </button>
          <button
            type="button"
            className={`simulation-engine__radio ${technicalIndex === 'average' ? 'simulation-engine__radio--active' : ''}`}
            onClick={() => setTechnicalIndex('average')}
          >
            <FaWalking style={{ marginRight: '4px' }} /> Moyen
          </button>
          <button
            type="button"
            className={`simulation-engine__radio ${technicalIndex === 'cautious' ? 'simulation-engine__radio--active' : ''}`}
            onClick={() => setTechnicalIndex('cautious')}
          >
            <GiTurtle style={{ marginRight: '4px' }} /> Prudent
          </button>
        </div>
      </div>

      {/* Indice d'Endurance */}
      <div className="simulation-engine__control">
        <label className="simulation-engine__label">Indice d'Endurance</label>
        <div className="simulation-engine__radio-group">
          <button
            type="button"
            className={`simulation-engine__radio ${enduranceIndex === 'elite' ? 'simulation-engine__radio--active' : ''}`}
            onClick={() => setEnduranceIndex('elite')}
          >
            <FaTrophy style={{ marginRight: '4px' }} /> Elite
          </button>
          <button
            type="button"
            className={`simulation-engine__radio ${enduranceIndex === 'experienced' ? 'simulation-engine__radio--active' : ''}`}
            onClick={() => setEnduranceIndex('experienced')}
          >
            <IoMdStar style={{ marginRight: '4px' }} /> Expérimenté
          </button>
          <button
            type="button"
            className={`simulation-engine__radio ${enduranceIndex === 'intermediate' ? 'simulation-engine__radio--active' : ''}`}
            onClick={() => setEnduranceIndex('intermediate')}
          >
            <IoMdStar style={{ marginRight: '4px' }} /> Intermédiaire
          </button>
          <button
            type="button"
            className={`simulation-engine__radio ${enduranceIndex === 'beginner' ? 'simulation-engine__radio--active' : ''}`}
            onClick={() => setEnduranceIndex('beginner')}
          >
            <FaMedal style={{ marginRight: '4px' }} /> Débutant
          </button>
        </div>
        <div className="simulation-engine__hint">
          {enduranceIndex === 'elite' && 'Vitesse stable du début à la fin'}
          {enduranceIndex === 'experienced' && 'Légère baisse de performance en fin de course (-5%)'}
          {enduranceIndex === 'intermediate' && 'Baisse progressive de performance (-10%)'}
          {enduranceIndex === 'beginner' && 'Baisse significative de 20% à partir de la mi-course'}
        </div>
      </div>

      {/* Indice d'Endurance */}
      <div className="simulation-engine__control">
        <label className="simulation-engine__label">Indice d'Endurance</label>
        <div className="simulation-engine__radio-group">
          <button
            type="button"
            className={`simulation-engine__radio ${enduranceIndex === 'elite' ? 'simulation-engine__radio--active' : ''}`}
            onClick={() => setEnduranceIndex('elite')}
          >
            <FaTrophy style={{ marginRight: '4px' }} /> Elite
          </button>
          <button
            type="button"
            className={`simulation-engine__radio ${enduranceIndex === 'experienced' ? 'simulation-engine__radio--active' : ''}`}
            onClick={() => setEnduranceIndex('experienced')}
          >
            <IoMdStar style={{ marginRight: '4px' }} /> Expérimenté
          </button>
          <button
            type="button"
            className={`simulation-engine__radio ${enduranceIndex === 'intermediate' ? 'simulation-engine__radio--active' : ''}`}
            onClick={() => setEnduranceIndex('intermediate')}
          >
            <IoMdStar style={{ marginRight: '4px' }} /> Intermédiaire
          </button>
          <button
            type="button"
            className={`simulation-engine__radio ${enduranceIndex === 'beginner' ? 'simulation-engine__radio--active' : ''}`}
            onClick={() => setEnduranceIndex('beginner')}
          >
            <FaMedal style={{ marginRight: '4px' }} /> Débutant
          </button>
        </div>
        <div className="simulation-engine__hint">
          {enduranceIndex === 'elite' && 'Vitesse stable du début à la fin'}
          {enduranceIndex === 'experienced' && 'Légère baisse de performance en fin de course (-5%)'}
          {enduranceIndex === 'intermediate' && 'Baisse progressive de performance (-10%)'}
          {enduranceIndex === 'beginner' && 'Baisse significative de 20% à partir de la mi-course'}
        </div>
      </div>

      {/* Temps estimé mis à jour */}
      {timeEstimate && (
        <div className="simulation-engine__result">
          <p className="simulation-engine__result-label">⏱️ Temps estimé (mis à jour)</p>
          <p className="simulation-engine__result-time">{timeEstimate.rangeFormatted}</p>
          {baseTimeEstimate && timeEstimate.totalMinutes !== baseTimeEstimate.totalMinutes && (
            <p className="simulation-engine__result-delta">
              {timeEstimate.totalMinutes > baseTimeEstimate.totalMinutes ? '+' : ''}
              {Math.round((timeEstimate.totalMinutes - baseTimeEstimate.totalMinutes) / 60)}h{' '}
              {Math.abs(Math.round((timeEstimate.totalMinutes - baseTimeEstimate.totalMinutes) % 60))}min vs estimation
              initiale
            </p>
          )}
        </div>
      )}

      {/* Barrières horaires */}
      {barriers.length > 0 && (
        <div className="simulation-engine__barriers">
          <p className="simulation-engine__barriers-title">
            <FiAlertCircle style={{ display: 'inline', marginRight: '8px', verticalAlign: 'middle', color: '#ef4444' }} />
            Barrières horaires critiques
          </p>
          {barriers.map((barrier) => (
            <div
              key={barrier.name}
              className={`simulation-engine__barrier ${barrier.isAtRisk ? 'simulation-engine__barrier--risk' : ''}`}
            >
              <div className="simulation-engine__barrier-header">
                <span className="simulation-engine__barrier-name">{barrier.name}</span>
                <span className="simulation-engine__barrier-distance">{barrier.distanceKm} km</span>
              </div>
              <div className="simulation-engine__barrier-info">
                <span>Arrivée estimée : {formatTime(barrier.estimatedArrivalHours)}</span>
                <span>Barrière : {formatTime(barrier.cutoffHours)}</span>
              </div>
              <div className="simulation-engine__barrier-margin">
                <div
                  className={`simulation-engine__barrier-gauge ${
                    barrier.isAtRisk ? 'simulation-engine__barrier-gauge--risk' : ''
                  }`}
                  style={{
                    width: `${Math.max(0, Math.min(100, (barrier.marginHours / 2) * 100))}%`,
                  }}
                />
                <span className="simulation-engine__barrier-margin-text">
                  Marge : {barrier.marginHours > 0 ? '+' : ''}
                  {formatTime(Math.abs(barrier.marginHours))}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
