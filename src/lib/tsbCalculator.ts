/**
 * Calcul du TSB (Training Stress Balance) basé sur CTL et ATL
 * Approche type "coach F1" : analyse de scénarios de charge d'entraînement
 */

import type { StravaActivity, StravaMetrics } from '../types/strava'

/**
 * Calcule le CTL (Chronic Training Load) - charge chronique sur ~42 jours
 * Utilise une moyenne pondérée exponentielle avec facteur de décroissance
 */
function calculateCTL(activities: StravaActivity[], days: number = 42): number {
  if (activities.length === 0) return 0

  const now = Date.now()
  const cutoffDate = now - days * 24 * 60 * 60 * 1000
  const relevantActivities = activities.filter(
    (act) => new Date(act.date).getTime() >= cutoffDate
  )

  if (relevantActivities.length === 0) return 0

  // Facteur de décroissance exponentielle (plus récent = plus important)
  const decayFactor = 1 - 1 / days // ~0.976 pour 42 jours

  let ctl = 0
  let totalWeight = 0

  relevantActivities.forEach((act) => {
    const daysAgo = (now - new Date(act.date).getTime()) / (24 * 60 * 60 * 1000)
    const weight = Math.pow(decayFactor, daysAgo)

    // TSS (Training Stress Score) simplifié basé sur distance et D+
    // Formule : TSS = (distance_km * 10) + (D+ * 0.3)
    const tss = (act.distanceKm || 0) * 10 + (act.elevationGain || 0) * 0.3

    ctl += tss * weight
    totalWeight += weight
  })

  return totalWeight > 0 ? ctl / totalWeight : 0
}

/**
 * Calcule l'ATL (Acute Training Load) - charge aiguë sur ~7 jours
 * Utilise une moyenne pondérée exponentielle avec facteur de décroissance plus rapide
 */
function calculateATL(activities: StravaActivity[], days: number = 7): number {
  if (activities.length === 0) return 0

  const now = Date.now()
  const cutoffDate = now - days * 24 * 60 * 60 * 1000
  const relevantActivities = activities.filter(
    (act) => new Date(act.date).getTime() >= cutoffDate
  )

  if (relevantActivities.length === 0) return 0

  // Facteur de décroissance plus rapide pour ATL (7 jours)
  const decayFactor = 1 - 1 / days // ~0.857 pour 7 jours

  let atl = 0
  let totalWeight = 0

  relevantActivities.forEach((act) => {
    const daysAgo = (now - new Date(act.date).getTime()) / (24 * 60 * 60 * 1000)
    const weight = Math.pow(decayFactor, daysAgo)

    // TSS (Training Stress Score) simplifié
    const tss = (act.distanceKm || 0) * 10 + (act.elevationGain || 0) * 0.3

    atl += tss * weight
    totalWeight += weight
  })

  return totalWeight > 0 ? atl / totalWeight : 0
}

/**
 * Calcule le TSB (Training Stress Balance) = CTL - ATL
 * Positif = Fraîcheur, Négatif = Fatigue
 */
export function calculateTSB(activities: StravaActivity[]): number {
  const ctl = calculateCTL(activities)
  const atl = calculateATL(activities)
  const tsb = ctl - atl

  // Normaliser entre -50 et +50 pour l'affichage
  return Math.max(-50, Math.min(50, Math.round(tsb)))
}

/**
 * Calcule le TSB à partir des métriques Strava (approximation si pas d'activités détaillées)
 */
export function calculateTSBFromMetrics(metrics: StravaMetrics | null): number {
  if (!metrics) return 0

  // Approximation basée sur la charge et la variation
  // Si la charge augmente rapidement (variation > 0), ATL > CTL → TSB négatif (fatigue)
  // Si la charge diminue ou est stable, CTL > ATL → TSB positif (fraîcheur)

  const baseLoad = metrics.loadScore || 0
  const variation = metrics.variation || 0

  // Simuler CTL et ATL à partir de la charge et variation
  // CTL = charge de base (plus stable)
  // ATL = charge récente (influencée par la variation)
  const ctl = baseLoad
  const atl = baseLoad * (1 + variation / 100)

  const tsb = ctl - atl

  // Normaliser entre -50 et +50
  return Math.max(-50, Math.min(50, Math.round(tsb / 10)))
}
