/**
 * Statistiques du Grand Raid Réunion 2025
 * Source: https://grandraid-reunion.v3.livetrail.net/fr/2025/statistics?raceId=GRR
 */

export type AbandonPoint = {
  name: string
  distanceKm: number
  abandons: number
  horsBarrieres: number
  arretesOrganisation: number
}

export type GrandRaidStats = {
  totalStarters: number
  totalAbandons: number
  totalFinishers: number
  abandonRate: number // 24.31%
  finisherRate: number // 75.69%
  abandonPoints: AbandonPoint[]
  finisherTimes: {
    min: number // heures
    max: number // heures
    distribution: Array<{ hours: number; percentage: number }>
  }
  utmbIndexStats: {
    finishersAverage: number
    abandonsAverage: number
    withoutIndexPercentage: number
  }
}

export const grandRaidStats: GrandRaidStats = {
  totalStarters: 2727,
  totalAbandons: 663,
  totalFinishers: 2064,
  abandonRate: 24.31,
  finisherRate: 75.69,
  abandonPoints: [
    { name: 'St Pierre', distanceKm: 0, abandons: 6, horsBarrieres: 0, arretesOrganisation: 0 },
    { name: 'Dom Vidot', distanceKm: 14, abandons: 29, horsBarrieres: 0, arretesOrganisation: 0 },
    { name: 'Dame paix', distanceKm: 34, abandons: 10, horsBarrieres: 0, arretesOrganisation: 0 },
    { name: 'Nez boeuf', distanceKm: 46, abandons: 26, horsBarrieres: 0, arretesOrganisation: 0 },
    { name: 'Mare Boue', distanceKm: 56, abandons: 9, horsBarrieres: 0, arretesOrganisation: 0 },
    { name: 'Croisée', distanceKm: 68, abandons: 70, horsBarrieres: 0, arretesOrganisation: 0 },
    { name: 'Le Bloc', distanceKm: 72, abandons: 134, horsBarrieres: 0, arretesOrganisation: 0 },
    { name: 'Cilaos', distanceKm: 77, abandons: 95, horsBarrieres: 0, arretesOrganisation: 0 },
    { name: 'Sentier T', distanceKm: 83, abandons: 20, horsBarrieres: 0, arretesOrganisation: 0 },
    { name: 'Marla', distanceKm: 89, abandons: 25, horsBarrieres: 0, arretesOrganisation: 0 },
    { name: 'Merles', distanceKm: 96, abandons: 25, horsBarrieres: 0, arretesOrganisation: 0 },
    { name: 'Sen. Scout', distanceKm: 98, abandons: 29, horsBarrieres: 0, arretesOrganisation: 0 },
    { name: 'Aurère', distanceKm: 107, abandons: 36, horsBarrieres: 0, arretesOrganisation: 0 },
    { name: 'Ilet Oran', distanceKm: 116, abandons: 41, horsBarrieres: 0, arretesOrganisation: 0 },
    { name: 'Tête dure', distanceKm: 124, abandons: 28, horsBarrieres: 0, arretesOrganisation: 0 },
    { name: 'Ilet Savan', distanceKm: 141, abandons: 12, horsBarrieres: 0, arretesOrganisation: 0 },
    { name: 'Ratinaud', distanceKm: 149, abandons: 10, horsBarrieres: 0, arretesOrganisation: 0 },
    { name: 'Possession', distanceKm: 157, abandons: 9, horsBarrieres: 0, arretesOrganisation: 0 },
    { name: 'Chaloupe', distanceKm: 164, abandons: 16, horsBarrieres: 0, arretesOrganisation: 0 },
    { name: 'Colorado', distanceKm: 173, abandons: 8, horsBarrieres: 0, arretesOrganisation: 0 },
  ],
  finisherTimes: {
    min: 22,
    max: 64,
    distribution: [
      { hours: 22, percentage: 0.6 },
      { hours: 24, percentage: 1.5 },
      { hours: 26, percentage: 2.2 },
      { hours: 28, percentage: 3.1 },
      { hours: 30, percentage: 4.5 },
      { hours: 32, percentage: 4.7 },
      { hours: 34, percentage: 5.5 },
      { hours: 36, percentage: 7.6 },
      { hours: 38, percentage: 9.0 },
      { hours: 40, percentage: 7.8 },
      { hours: 42, percentage: 5.4 },
      { hours: 44, percentage: 5.7 },
      { hours: 46, percentage: 6.4 },
      { hours: 48, percentage: 6.6 },
      { hours: 50, percentage: 7.3 },
      { hours: 52, percentage: 9.3 },
      { hours: 54, percentage: 8.4 },
      { hours: 56, percentage: 3.5 },
    ],
  },
  utmbIndexStats: {
    finishersAverage: 550, // Estimation basée sur la distribution
    abandonsAverage: 400, // Estimation basée sur la distribution
    withoutIndexPercentage: 11,
  },
}

/**
 * Trouve les points d'abandon critiques (avec le plus d'abandons)
 */
export function getCriticalAbandonPoints(stats: GrandRaidStats, limit: number = 3): AbandonPoint[] {
  return [...stats.abandonPoints]
    .sort((a, b) => b.abandons - a.abandons)
    .slice(0, limit)
}

/**
 * Trouve le point d'abandon le plus critique avant une distance donnée
 */
export function getCriticalPointBeforeDistance(stats: GrandRaidStats, distanceKm: number): AbandonPoint | null {
  const pointsBefore = stats.abandonPoints.filter((p) => p.distanceKm <= distanceKm)
  if (pointsBefore.length === 0) return null
  return pointsBefore.reduce((max, p) => (p.abandons > max.abandons ? p : max), pointsBefore[0])
}
