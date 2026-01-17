import type { StravaMetrics } from '../types/strava'
import type { StravaSegment } from '../types/strava'

/**
 * Analyse les segments critiques d'une route pour un coureur
 */
export function analyzeSegments(
  segments: StravaSegment[],
  metrics: StravaMetrics | null
): {
  criticalClimbs: StravaSegment[]
  criticalDescents: StravaSegment[]
  recommendations: string[]
} {
  if (!metrics || segments.length === 0) {
    return {
      criticalClimbs: [],
      criticalDescents: [],
      recommendations: [],
    }
  }

  const criticalClimbs: StravaSegment[] = []
  const criticalDescents: StravaSegment[] = []
  const recommendations: string[] = []

  // Analyser les montées critiques
  segments
    .filter((seg) => seg.type === 'climb' && seg.elevation_gain > 0)
    .forEach((segment) => {
      const segmentDistanceKm = segment.distance / 1000
      const segmentDPlus = segment.elevation_gain
      const segmentGrade = segment.average_grade

      // Critères pour une montée critique :
      // 1. D+ > D+ max du coureur
      // 2. Pente > 20% (très raide)
      // 3. Distance > 5 km avec D+ > 500m
      const isCritical =
        segmentDPlus > metrics.longRunDPlus ||
        segmentGrade > 20 ||
        (segmentDistanceKm > 5 && segmentDPlus > 500)

      if (isCritical) {
        criticalClimbs.push(segment)
      }
    })

  // Analyser les descentes critiques
  segments
    .filter((seg) => seg.type === 'descent' && seg.elevation_gain < 0)
    .forEach((segment) => {
      const segmentDistanceKm = segment.distance / 1000
      const segmentDMinus = Math.abs(segment.elevation_gain)
      const segmentGrade = Math.abs(segment.average_grade)

      // Critères pour une descente critique :
      // 1. Pente > 30% (très technique)
      // 2. Descente > 500m sur < 3km
      const isCritical = segmentGrade > 30 || (segmentDMinus > 500 && segmentDistanceKm < 3)

      if (isCritical) {
        criticalDescents.push(segment)
      }
    })

  // Générer des recommandations basées sur les segments critiques
  if (criticalClimbs.length > 0) {
    const longestClimb = criticalClimbs.reduce((max, seg) => (seg.distance > max.distance ? seg : max), criticalClimbs[0])
    recommendations.push(
      `Segment critique : "${longestClimb.name}" (${(longestClimb.distance / 1000).toFixed(1)} km, +${Math.round(longestClimb.elevation_gain)} m, ${longestClimb.average_grade.toFixed(1)}%)`
    )
    recommendations.push('Travailler spécifiquement les montées longues et raides')
  }

  if (criticalDescents.length > 0) {
    const steepestDescent = criticalDescents.reduce((max, seg) => (Math.abs(seg.average_grade) > Math.abs(max.average_grade) ? seg : max), criticalDescents[0])
    recommendations.push(
      `Descente technique : "${steepestDescent.name}" (${(steepestDescent.distance / 1000).toFixed(1)} km, ${Math.round(Math.abs(steepestDescent.elevation_gain))} m, ${Math.abs(steepestDescent.average_grade).toFixed(1)}%)`
    )
    recommendations.push('Travailler la technique de descente et le renforcement des quadriceps')
  }

  return {
    criticalClimbs,
    criticalDescents,
    recommendations,
  }
}

/**
 * Parse les segments depuis une URL Strava route
 * Pour l'instant, on retourne un tableau vide car il faut utiliser l'API Strava
 * Cette fonction sera utilisée quand on aura l'ID de route Strava
 */
export async function fetchRouteSegments(
  routeId: string,
  accessToken: string
): Promise<StravaSegment[]> {
  try {
    const response = await fetch(`/api/strava/route-segments?route_id=${routeId}`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    })

    if (!response.ok) {
      console.error('Erreur lors de la récupération des segments:', await response.text())
      return []
    }

    const data = await response.json()
    return data.segments || []
  } catch (error) {
    console.error('Erreur lors de la récupération des segments:', error)
    return []
  }
}
