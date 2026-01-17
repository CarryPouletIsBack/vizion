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
