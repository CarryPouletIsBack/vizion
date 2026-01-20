/**
 * Analyse du profil d'élévation pour identifier les zones difficiles/faciles
 * Approche type "coach F1" : analyse de scénarios de performance
 */

import type { StravaMetrics } from '../types/strava'
import { analyzeProfileTechnicity } from './profileTechnicity'

export type ZoneDifficulty = 'easy' | 'moderate' | 'hard' | 'critical'

export type ProfileZone = {
  startDistance: number
  endDistance: number
  difficulty: ZoneDifficulty
  elevationGain: number
  elevationLoss: number
  averageGrade: number
  description: string
  color: string
}

/**
 * Calcule le D+ et D- total depuis un profil
 */
export function calculateElevationStats(profile: Array<[number, number]>): {
  elevationGain: number
  elevationLoss: number
} {
  if (profile.length < 2) return { elevationGain: 0, elevationLoss: 0 }

  let elevationGain = 0
  let elevationLoss = 0

  for (let i = 1; i < profile.length; i++) {
    const [, elev1] = profile[i - 1]
    const [, elev2] = profile[i]
    const delta = elev2 - elev1

    if (delta > 0) {
      elevationGain += delta
    } else {
      elevationLoss += Math.abs(delta)
    }
  }

  return {
    elevationGain: Math.round(elevationGain),
    elevationLoss: Math.round(elevationLoss),
  }
}

/**
 * Analyse le profil pour identifier les zones difficiles selon le niveau du coureur
 * Compare les exigences du parcours avec les capacités du coureur
 */
export function analyzeProfileZones(
  profile: Array<[number, number]>,
  metrics: StravaMetrics | null,
  courseDistanceKm: number,
  courseElevationGain: number
): ProfileZone[] {
  if (profile.length < 2) return []

  const segments = analyzeProfileTechnicity(profile)
  const zones: ProfileZone[] = []

  if (!metrics) {
    // Sans métriques, utiliser uniquement la technicité
    let currentZone: ProfileZone | null = null

    segments.forEach((seg) => {
      const difficulty: ZoneDifficulty =
        seg.technicity === 'chaos' ? 'critical' : seg.technicity === 'technical' ? 'hard' : 'easy'

      if (!currentZone || currentZone.difficulty !== difficulty) {
        if (currentZone) zones.push(currentZone)

        currentZone = {
          startDistance: seg.startDistance,
          endDistance: seg.endDistance,
          difficulty,
          elevationGain: seg.grade > 0 ? (seg.endDistance - seg.startDistance) * (seg.grade / 100) * 10 : 0,
          elevationLoss: seg.grade < 0 ? Math.abs((seg.endDistance - seg.startDistance) * (seg.grade / 100) * 10) : 0,
          averageGrade: seg.grade,
          description: getDifficultyDescription(difficulty, seg.grade),
          color: getDifficultyColor(difficulty),
        }
      } else {
        currentZone.endDistance = seg.endDistance
        currentZone.elevationGain += seg.grade > 0 ? (seg.endDistance - seg.startDistance) * (seg.grade / 100) * 10 : 0
        currentZone.elevationLoss += seg.grade < 0 ? Math.abs((seg.endDistance - seg.startDistance) * (seg.grade / 100) * 10) : 0
      }
    })

    if (currentZone) zones.push(currentZone)
    return zones
  }

  // Avec métriques : comparer les capacités du coureur avec les exigences du parcours
  const runnerDPlusPerKm = metrics.longRunDistanceKm > 0 && metrics.longRunDPlus > 0
    ? metrics.longRunDPlus / metrics.longRunDistanceKm
    : metrics.dPlusPerWeek / Math.max(metrics.kmPerWeek, 1)

  const courseDPlusPerKm = courseDistanceKm > 0 ? courseElevationGain / courseDistanceKm : 0

  // Facteur de capacité : 1.0 = même niveau, < 1.0 = moins capable, > 1.0 = plus capable
  const capacityFactor = courseDPlusPerKm > 0
    ? Math.min(1.5, Math.max(0.5, runnerDPlusPerKm / courseDPlusPerKm))
    : 1

  let currentZone: ProfileZone | null = null

  segments.forEach((seg) => {
    const segmentDPlusPerKm = seg.grade > 0 ? (seg.grade / 100) * 10 : 0
    const absGrade = Math.abs(seg.grade)

    // Déterminer la difficulté selon la capacité du coureur et la technicité
    let difficulty: ZoneDifficulty

    if (seg.technicity === 'chaos') {
      // Chaos = toujours critique
      difficulty = 'critical'
    } else if (seg.technicity === 'technical') {
      // Technique : difficile si le coureur est moins capable
      if (capacityFactor < 0.7) {
        difficulty = 'critical'
      } else if (capacityFactor < 0.9) {
        difficulty = 'hard'
      } else {
        difficulty = 'moderate'
      }
    } else {
      // Zone roulante : facile si le coureur est capable, modérée sinon
      if (absGrade > 20 || segmentDPlusPerKm > runnerDPlusPerKm * 1.5) {
        // Pente très raide ou bien au-dessus des capacités
        difficulty = capacityFactor < 0.8 ? 'hard' : 'moderate'
      } else if (absGrade > 10 || segmentDPlusPerKm > runnerDPlusPerKm * 1.2) {
        // Pente modérée ou légèrement au-dessus
        difficulty = 'moderate'
      } else {
        // Pente douce, dans les capacités
        difficulty = 'easy'
      }
    }

    if (!currentZone || currentZone.difficulty !== difficulty) {
      if (currentZone) zones.push(currentZone)

      currentZone = {
        startDistance: seg.startDistance,
        endDistance: seg.endDistance,
        difficulty,
        elevationGain: seg.grade > 0 ? (seg.endDistance - seg.startDistance) * (seg.grade / 100) * 10 : 0,
        elevationLoss: seg.grade < 0 ? Math.abs((seg.endDistance - seg.startDistance) * (seg.grade / 100) * 10) : 0,
        averageGrade: seg.grade,
        description: getDifficultyDescription(difficulty, seg.grade, capacityFactor),
        color: getDifficultyColor(difficulty),
      }
    } else {
      currentZone.endDistance = seg.endDistance
      currentZone.elevationGain += seg.grade > 0 ? (seg.endDistance - seg.startDistance) * (seg.grade / 100) * 10 : 0
      currentZone.elevationLoss += seg.grade < 0 ? Math.abs((seg.endDistance - seg.startDistance) * (seg.grade / 100) * 10) : 0
    }
  })

  if (currentZone) zones.push(currentZone)

  return zones
}

function getDifficultyDescription(
  difficulty: ZoneDifficulty,
  grade: number,
  _capacityFactor?: number
): string {
  const gradeStr = Math.abs(grade).toFixed(1)
  const direction = grade > 0 ? 'montée' : 'descente'

  switch (difficulty) {
    case 'easy':
      return `Zone roulante (${direction} ${gradeStr}%) - À l'aise`
    case 'moderate':
      return `Zone modérée (${direction} ${gradeStr}%) - Gestion de l'effort nécessaire`
    case 'hard':
      return `Zone difficile (${direction} ${gradeStr}%) - Attention à la fatigue`
    case 'critical':
      return `Zone critique (${direction} ${gradeStr}%) - Risque de surchauffe`
    default:
      return `Zone ${difficulty}`
  }
}

function getDifficultyColor(difficulty: ZoneDifficulty): string {
  switch (difficulty) {
    case 'easy':
      return '#22c55e' // Vert
    case 'moderate':
      return '#f59e0b' // Orange
    case 'hard':
      return '#ef4444' // Rouge
    case 'critical':
      return '#dc2626' // Rouge foncé
    default:
      return '#9ca3af'
  }
}
