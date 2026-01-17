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
  // Données de performance du coureur (optionnel, enrichi depuis route-performance)
  best_time?: number | null // meilleur temps en secondes
  average_time?: number | null // temps moyen en secondes
  attempts?: number // nombre de tentatives
  last_attempt_date?: string | null // date ISO de la dernière tentative
}
