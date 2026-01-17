import type { StravaMetrics } from '../types/strava'

/**
 * Calcule une estimation du temps de course trail basée sur la formule de pacing-trail.fr
 * https://pacing-trail.fr/calculateur-de-temps-de-course-trail/
 */

export type TimeEstimateParams = {
  distanceKm: number
  elevationGain: number
  basePaceMinPerKm?: number // Allure de base (min/km) - si non fournie, calculée depuis les métriques
  temperature?: number // Température en °C (optionnel)
  bagWeight?: number // Poids du sac en kg (optionnel)
  refuelStops?: number // Nombre de ravitaillements (optionnel)
  refuelTimePerStop?: number // Temps par ravitaillement en minutes (optionnel)
}

export type TimeEstimate = {
  totalMinutes: number
  totalHours: number
  totalMinutesRemainder: number
  formatted: string // Format "Xh Ymin"
  basePace: number // Allure de base utilisée (min/km)
  finalPace: number // Allure finale après ajustements (min/km)
}

/**
 * Calcule l'allure de base depuis les métriques Strava
 * Basé sur la vitesse moyenne des sorties longues
 */
function calculateBasePaceFromMetrics(metrics: StravaMetrics | null): number {
  if (!metrics) {
    return 6.0 // Allure par défaut : 6 min/km (10 km/h)
  }

  // Estimer l'allure de base depuis les sorties longues
  // Si on a une sortie longue, on peut estimer l'allure
  // Sinon, on utilise le volume hebdomadaire comme indicateur
  
  if (metrics.longRunDistanceKm > 0) {
    // Estimation : si le coureur fait X km en Y heures, son allure moyenne est Y/X
    // On utilise une estimation basée sur le volume : plus de volume = meilleure allure
    const estimatedSpeedKmh = Math.max(8, Math.min(12, 10 - (metrics.kmPerWeek - 20) / 50))
    return 60 / estimatedSpeedKmh // Convertir km/h en min/km
  }

  // Estimation basée sur le volume hebdomadaire
  const estimatedSpeedKmh = Math.max(8, Math.min(12, 9 + metrics.kmPerWeek / 100))
  return 60 / estimatedSpeedKmh
}

/**
 * Estime le temps de course trail en tenant compte de tous les facteurs
 */
export function estimateTrailTime(
  params: TimeEstimateParams,
  metrics: StravaMetrics | null
): TimeEstimate {
  const {
    distanceKm,
    elevationGain,
    basePaceMinPerKm,
    temperature = 15, // Température par défaut : 15°C
    bagWeight = 0, // Poids du sac par défaut : 0 kg
    refuelStops = 0,
    refuelTimePerStop = 2, // 2 minutes par ravitaillement par défaut
  } = params

  // 1. Allure de base
  const basePace = basePaceMinPerKm || calculateBasePaceFromMetrics(metrics)

  // 2. Ajustement pour le dénivelé
  // +1,5% de temps par tranche de 1000m de dénivelé
  const elevationFactor = 1 + 0.015 * (elevationGain / 1000)
  let adjustedPace = basePace * elevationFactor

  // 3. Ajustement pour la distance
  // Pour chaque tranche de 40 km, on retire 1 km/h à la vitesse
  const speedKmh = 60 / adjustedPace
  const distanceTranches = Math.floor(distanceKm / 40)
  const adjustedSpeedKmh = Math.max(4, speedKmh - distanceTranches) // Minimum 4 km/h
  adjustedPace = 60 / adjustedSpeedKmh

  // 4. Ajustement pour la météo
  // +2s par degré si < 0°C ou > 20°C
  if (temperature < 0 || temperature > 20) {
    const tempAdjustment = Math.abs(temperature - (temperature < 0 ? 0 : 20)) * 2 // secondes
    adjustedPace += tempAdjustment / 60 // Convertir en minutes
  }

  // 5. Ajustement pour le poids du sac
  // +5s par kg
  const bagAdjustment = bagWeight * 5 // secondes
  adjustedPace += bagAdjustment / 60 // Convertir en minutes

  // 6. Temps de course (sans ravitaillements)
  const courseTimeMinutes = adjustedPace * distanceKm

  // 7. Ajouter les temps de ravitaillement
  const refuelTimeMinutes = refuelStops * refuelTimePerStop
  const totalMinutes = courseTimeMinutes + refuelTimeMinutes

  // 8. Conversion en heures : minutes
  const totalHours = Math.floor(totalMinutes / 60)
  const totalMinutesRemainder = Math.round(totalMinutes % 60)

  return {
    totalMinutes,
    totalHours,
    totalMinutesRemainder,
    formatted: `${totalHours}h ${totalMinutesRemainder}min`,
    basePace,
    finalPace: adjustedPace,
  }
}

/**
 * Compare le temps estimé avec un temps de référence (ex: temps de qualification)
 * Retourne un ratio de performance
 */
export function compareWithReferenceTime(
  estimatedTime: TimeEstimate,
  referenceTimeMinutes: number
): {
  ratio: number // Ratio estimé / référence (1.0 = même temps, >1.0 = plus lent, <1.0 = plus rapide)
  differenceMinutes: number
  isFeasible: boolean // true si le temps estimé est proche ou meilleur que la référence
} {
  const ratio = estimatedTime.totalMinutes / referenceTimeMinutes
  const differenceMinutes = estimatedTime.totalMinutes - referenceTimeMinutes

  // Considéré comme faisable si le ratio est < 1.2 (20% de marge)
  const isFeasible = ratio < 1.2

  return {
    ratio,
    differenceMinutes,
    isFeasible,
  }
}
