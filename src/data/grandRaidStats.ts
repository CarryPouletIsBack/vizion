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

export type CheckpointTime = {
  name: string
  distanceKm: number
  elevationGain: number
  // Temps de passage pour différents profils de coureurs (en heures depuis le départ)
  times: {
    elite: number // 1er finisher (top 1%)
    fast: number // Top 10% (244ème)
    average: number // Moyen (968ème, ~50%)
    slow: number // Lent (2064ème, ~75%)
  }
  // Vitesses moyennes sur le segment précédent (km/h)
  segmentSpeeds: {
    elite: number
    fast: number
    average: number
    slow: number
  }
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
  checkpoints: CheckpointTime[] // Temps de passage par point de contrôle
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
  checkpoints: [
    {
      name: 'St Pierre Ravine Blanche',
      distanceKm: 0,
      elevationGain: 0,
      times: { elite: 0, fast: 0, average: 0, slow: 0 },
      segmentSpeeds: { elite: 0, fast: 0, average: 0, slow: 0 },
    },
    {
      name: 'Domaine Vidot',
      distanceKm: 14.1,
      elevationGain: 658,
      times: { elite: 1.17, fast: 1.62, average: 1.58, slow: 1.83 }, // 1h10, 1h37, 1h34, 1h49
      segmentSpeeds: { elite: 12.0, fast: 8.7, average: 8.9, slow: 7.7 },
    },
    {
      name: 'Notre Dame de la Paix',
      distanceKm: 33.5,
      elevationGain: 2036,
      times: { elite: 3.28, fast: 4.90, average: 4.52, slow: 5.98 }, // 3h16, 4h54, 4h31, 5h58
      segmentSpeeds: { elite: 9.2, fast: 5.9, average: 6.6, slow: 4.7 },
    },
    {
      name: 'Parking Aire Nez de Boeuf',
      distanceKm: 45.6,
      elevationGain: 2662,
      times: { elite: 4.53, fast: 7.00, average: 6.53, slow: 8.54 }, // 4h32, 7h00, 6h32, 8h32
      segmentSpeeds: { elite: 9.6, fast: 5.7, average: 6.0, slow: 4.7 },
    },
    {
      name: 'Mare à Boue',
      distanceKm: 56,
      elevationGain: 2722,
      times: { elite: 5.48, fast: 8.54, average: 7.91, slow: 10.37 }, // 5h28, 8h32, 7h54, 10h22
      segmentSpeeds: { elite: 11.0, fast: 6.7, average: 7.5, slow: 5.7 },
    },
    {
      name: 'Croisée coteaux Kerveguen',
      distanceKm: 68.1,
      elevationGain: 3701,
      times: { elite: 7.44, fast: 11.43, average: 10.75, slow: 14.94 }, // 7h26, 11h25, 10h45, 14h56
      segmentSpeeds: { elite: 6.2, fast: 4.2, average: 4.3, slow: 2.7 },
    },
    {
      name: 'Le Bloc',
      distanceKm: 72.2,
      elevationGain: 3701,
      times: { elite: 8.07, fast: 12.35, average: 11.78, slow: 16.85 }, // 8h04, 12h21, 11h47, 16h50
      segmentSpeeds: { elite: 6.5, fast: 4.4, average: 4.0, slow: 2.1 },
    },
    {
      name: 'Cilaos (Stade)',
      distanceKm: 76.7,
      elevationGain: 3836,
      times: { elite: 8.54, fast: 13.03, average: 12.49, slow: 17.90 }, // 8h32, 13h01, 12h29, 17h54
      segmentSpeeds: { elite: 9.5, fast: 6.5, average: 6.2, slow: 4.2 },
    },
    {
      name: 'Sentier Taïbit',
      distanceKm: 83.3,
      elevationGain: 4335,
      times: { elite: 9.50, fast: 15.18, average: 15.83, slow: 21.55 }, // 9h30, 15h10, 15h50, 21h33
      segmentSpeeds: { elite: 6.9, fast: 3.1, average: 2.0, slow: 1.8 },
    },
    {
      name: 'Marla',
      distanceKm: 89.3,
      elevationGain: 5171,
      times: { elite: 10.60, fast: 17.03, average: 18.04, slow: 24.38 }, // 10h36, 17h01, 18h02, 24h23
      segmentSpeeds: { elite: 5.5, fast: 3.3, average: 2.7, slow: 2.1 },
    },
    {
      name: 'Plaine des Merles',
      distanceKm: 95.9,
      elevationGain: 5654,
      times: { elite: 11.56, fast: 18.57, average: 20.44, slow: 28.27 }, // 11h34, 18h34, 20h26, 28h16
      segmentSpeeds: { elite: 6.8, fast: 4.2, average: 2.7, slow: 1.7 },
    },
    {
      name: 'Sentier Scout',
      distanceKm: 97.9,
      elevationGain: 5670,
      times: { elite: 11.79, fast: 18.97, average: 20.98, slow: 29.16 }, // 11h47, 18h58, 20h58, 29h09
      segmentSpeeds: { elite: 9.0, fast: 5.2, average: 3.8, slow: 2.3 },
    },
    {
      name: 'Aurère',
      distanceKm: 106.6,
      elevationGain: 5921,
      times: { elite: 12.87, fast: 20.60, average: 22.88, slow: 32.25 }, // 12h52, 20h36, 22h52, 32h15
      segmentSpeeds: { elite: 8.0, fast: 5.3, average: 4.5, slow: 2.8 },
    },
    {
      name: 'Ilet des orangers',
      distanceKm: 116.4,
      elevationGain: 6822,
      times: { elite: 14.47, fast: 23.61, average: 26.98, slow: 39.30 }, // 14h28, 23h36, 26h59, 39h18
      segmentSpeeds: { elite: 6.1, fast: 3.3, average: 2.4, slow: 1.4 },
    },
    {
      name: 'Maido tête dure',
      distanceKm: 124.2,
      elevationGain: 7985,
      times: { elite: 16.12, fast: 27.39, average: 32.02, slow: 43.87 }, // 16h07, 27h23, 32h01, 43h52
      segmentSpeeds: { elite: 4.7, fast: 2.1, average: 1.6, slow: 1.7 },
    },
    {
      name: 'Ilet Savannah',
      distanceKm: 141.2,
      elevationGain: 8019,
      times: { elite: 17.82, fast: 30.44, average: 36.59, slow: 48.91 }, // 17h49, 30h27, 36h36, 48h55
      segmentSpeeds: { elite: 10.0, fast: 5.6, average: 3.7, slow: 3.4 },
    },
    {
      name: 'Chemin Ratinaud',
      distanceKm: 148.5,
      elevationGain: 8642,
      times: { elite: 19.00, fast: 33.15, average: 40.66, slow: 51.88 }, // 19h00, 33h10, 40h39, 51h53
      segmentSpeeds: { elite: 6.2, fast: 2.7, average: 1.8, slow: 2.5 },
    },
    {
      name: 'La possession',
      distanceKm: 156.6,
      elevationGain: 8826,
      times: { elite: 20.20, fast: 34.73, average: 43.38, slow: 55.71 }, // 20h12, 34h43, 43h23, 55h43
      segmentSpeeds: { elite: 6.8, fast: 5.2, average: 3.0, slow: 2.1 },
    },
    {
      name: 'Grande Chaloupe',
      distanceKm: 164,
      elevationGain: 9169,
      times: { elite: 21.19, fast: 36.40, average: 45.72, slow: 58.51 }, // 21h11, 36h24, 45h43, 58h31
      segmentSpeeds: { elite: 7.4, fast: 4.4, average: 3.1, slow: 2.6 },
    },
    {
      name: 'Le Colorado',
      distanceKm: 173.2,
      elevationGain: 9991,
      times: { elite: 22.62, fast: 38.50, average: 48.05, slow: 62.80 }, // 22h37, 38h30, 48h03, 62h48
      segmentSpeeds: { elite: 6.4, fast: 4.4, average: 3.9, slow: 2.1 },
    },
    {
      name: 'La Vigie',
      distanceKm: 177.3,
      elevationGain: 9996,
      times: { elite: 23.09, fast: 39.08, average: 48.70, slow: 64.67 }, // 23h05, 39h05, 48h12, 64h40
      segmentSpeeds: { elite: 8.7, fast: 7.0, average: 3.6, slow: 2.2 },
    },
    {
      name: 'St Denis La Redoute',
      distanceKm: 180.3,
      elevationGain: 10019,
      times: { elite: 23.53, fast: 39.55, average: 49.85, slow: 65.99 }, // 23h32, 39h33, 49h51, 65h59
      segmentSpeeds: { elite: 6.8, fast: 6.4, average: 4.7, slow: 2.3 },
    },
  ],
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
