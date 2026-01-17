export type StravaActivity = {
  id: string
  date: string // ISO
  distanceKm: number
  elevationGain: number
  movingTimeSec: number
}

export type StravaMetrics = {
  kmPerWeek: number
  dPlusPerWeek: number
  longRunDistanceKm: number
  longRunDPlus: number
  regularity: 'bonne' | 'moyenne' | 'faible'
  variation: number
  loadScore: number
  loadDelta: number
  recommendations: string[]
  targetDPlusPerWeek?: number
}

export type StravaSegment = {
  id: number
  name: string
  distance: number // en mètres
  elevation_gain: number // en mètres (positif pour montée, négatif pour descente)
  average_grade: number // en pourcentage
  type: 'climb' | 'descent' | 'flat'
}
