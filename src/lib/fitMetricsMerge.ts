import type { StravaMetrics } from '../types/strava'

/** Résumé d'une activité .fit (champs utilisés pour la fusion). */
type FitSummaryInput = {
  distanceKm?: number | null
  durationSec?: number | null
  ascentM?: number | null
  sport?: string | null
}

/** Normalise un résumé (camelCase ou snake_case depuis Supabase/localStorage). */
function normalizeFitSummary(raw: unknown): FitSummaryInput | null {
  if (raw == null || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  const distanceKm = (o.distanceKm ?? o.distance_km) != null ? Number(o.distanceKm ?? o.distance_km) : null
  const durationSec = (o.durationSec ?? o.duration_sec) != null ? Number(o.durationSec ?? o.duration_sec) : null
  const ascentM = (o.ascentM ?? o.ascent_m) != null ? Number(o.ascentM ?? o.ascent_m) : null
  const sport = (o.sport != null && typeof o.sport === 'string') ? o.sport : null
  if (distanceKm == null && ascentM == null && durationSec == null) return null
  return { distanceKm: distanceKm ?? undefined, durationSec: durationSec ?? undefined, ascentM: ascentM ?? undefined, sport }
}

/**
 * Fusionne les métriques Strava avec le résumé d'un fichier .fit importé.
 * - Si seul le FIT est disponible : construit des métriques minimales pour l'analyse.
 * - Si les deux : met à jour la "longue sortie" (distance + D+) avec le max Strava / FIT.
 */
export function mergeMetricsWithFit(
  metrics: StravaMetrics | null,
  fit: FitSummaryInput | null
): StravaMetrics | null {
  if (!fit || (fit.distanceKm == null && fit.ascentM == null && fit.durationSec == null)) {
    return metrics
  }

  const distanceKm = fit.distanceKm ?? 0
  const ascentM = fit.ascentM ?? 0

  if (!metrics) {
    return syntheticMetricsFromFit(distanceKm, ascentM)
  }

  return {
    ...metrics,
    longRunDistanceKm: Math.max(metrics.longRunDistanceKm, distanceKm),
    longRunDPlus: Math.max(metrics.longRunDPlus, ascentM),
  }
}

function syntheticMetricsFromFit(distanceKm: number, ascentM: number): StravaMetrics {
  const loadScore = Math.round(distanceKm * 10 + ascentM * 0.3)
  return {
    kmPerWeek: Math.round(distanceKm),
    dPlusPerWeek: Math.round(ascentM),
    longRunDistanceKm: Math.round(distanceKm),
    longRunDPlus: Math.round(ascentM),
    regularity: 'moyenne',
    variation: 0,
    loadScore,
    loadDelta: 0,
    recommendations: [],
    targetDPlusPerWeek: 2800,
  }
}

/**
 * Construit des métriques à partir des 5 (ou moins) sorties .fit les plus longues.
 * - Longue sortie = max distance et max D+ parmi les FITs
 * - Volume hebdo / charge = moyenne des sorties (approximation sur 6 semaines)
 */
export function syntheticMetricsFromFitList(fitList: (FitSummaryInput | unknown)[]): StravaMetrics | null {
  const list = fitList
    .map((f) => (f && typeof f === 'object' ? normalizeFitSummary(f) : null))
    .filter((f): f is FitSummaryInput => f != null)
  if (list.length === 0) return null

  const distances = list.map((f) => (typeof f.distanceKm === 'number' ? f.distanceKm : 0))
  const ascents = list.map((f) => (typeof f.ascentM === 'number' ? f.ascentM : 0))
  const longRunKm = Math.max(...distances)
  const longRunDPlus = Math.max(...ascents)
  const avgKm = distances.reduce((a, b) => a + b, 0) / list.length
  const avgDPlus = ascents.reduce((a, b) => a + b, 0) / list.length
  const loadScore = Math.round(avgKm * 10 + avgDPlus * 0.3)

  return {
    kmPerWeek: Math.round(avgKm),
    dPlusPerWeek: Math.round(avgDPlus),
    longRunDistanceKm: Math.round(longRunKm),
    longRunDPlus: Math.round(longRunDPlus),
    regularity: list.length >= 4 ? 'bonne' : list.length >= 2 ? 'moyenne' : 'faible',
    variation: 0,
    loadScore,
    loadDelta: 0,
    recommendations: [],
    targetDPlusPerWeek: 2800,
  }
}

/**
 * Fusionne métriques Strava avec la liste des 5 sorties .fit les plus longues.
 * Si pas de Strava, utilise uniquement les FITs.
 */
export function mergeMetricsWithFitList(
  metrics: StravaMetrics | null,
  fitList: (FitSummaryInput | unknown)[]
): StravaMetrics | null {
  const fromFit = syntheticMetricsFromFitList(fitList)
  if (!fromFit) return metrics
  if (!metrics) return fromFit
  return {
    ...metrics,
    longRunDistanceKm: Math.max(metrics.longRunDistanceKm, fromFit.longRunDistanceKm),
    longRunDPlus: Math.max(metrics.longRunDPlus, fromFit.longRunDPlus),
  }
}
