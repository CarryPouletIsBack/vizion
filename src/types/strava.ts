export type StravaActivity = {
  id: string
  date: string // ISO
  distanceKm: number
  elevationGain: number
  movingTimeSec: number
  elapsedTimeSec?: number // Temps total (inclut pauses)
  averageSpeedKmh?: number // Vitesse moyenne (km/h)
  maxSpeedKmh?: number // Vitesse max (km/h)
  averageHeartrate?: number // FC moyenne (bpm)
  maxHeartrate?: number // FC max (bpm)
  averageCadence?: number // Cadence moyenne (spm - steps per minute)
  calories?: number // Calories brûlées
  sufferScore?: number // Suffer Score Strava (0-200+)
  achievementCount?: number // Nombre de PRs/KOMs
  prCount?: number // Nombre de records personnels
  kudosCount?: number // Nombre de kudos (indicateur social)
  type?: string // Type d'activité (Run, TrailRun, etc.)
  name?: string // Nom de l'activité
  // Nouvelles données enrichies
  description?: string
  timezone?: string
  utcOffset?: number
  startLatlng?: [number, number] // [lat, lng]
  endLatlng?: [number, number]
  startLocation?: string
  achievementCountDetails?: number
  kudosCountDetails?: number
  commentCount?: number
  athleteCount?: number
  trainer?: boolean
  commute?: boolean
  manual?: boolean
  private?: boolean
  flagged?: boolean
  workoutType?: number // 0=default, 1=race, 2=long run, 3=workout
  gearId?: string
  averageWatts?: number
  weightedAverageWatts?: number
  kilojoules?: number
  deviceWatts?: boolean
  hasHeartrate?: boolean
  hasKudoed?: boolean
  splitsMetric?: Array<{
    distance: number
    elapsedTime: number
    elevationDifference: number
    movingTime: number
    split: number
    averageSpeed: number
    paceZone: number
  }>
  splitsStandard?: Array<{
    distance: number
    elapsedTime: number
    elevationDifference: number
    movingTime: number
    split: number
    averageSpeed: number
    paceZone: number
  }>
  bestEfforts?: Array<{
    id: string
    name: string
    distance: number
    movingTime: number
    elapsedTime: number
    prRank?: number
  }>
  segmentEfforts?: Array<{
    id: string
    name?: string
    segmentId: string
    distance: number
    movingTime: number
    averageGrade: number
    elevationDifference: number
  }>
}

export type StravaAthlete = {
  id: string
  username?: string
  firstname?: string
  lastname?: string
  city?: string
  state?: string
  country?: string
  sex?: 'M' | 'F'
  premium: boolean
  summit: boolean
  createdAt?: string
  updatedAt?: string
  followerCount?: number
  friendCount?: number
  measurementPreference: 'meters' | 'feet'
  ftp?: number // Functional Threshold Power
  weight?: number // kg
  clubs?: Array<{
    id: string
    name: string
    profile?: string
    coverPhoto?: string
    activityTypes?: string[]
  }>
  bikes?: Array<{
    id: string
    name: string
    distance: number // mètres
    primary: boolean
  }>
  shoes?: Array<{
    id: string
    name: string
    distance: number // mètres
    primary: boolean
  }>
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
  // Nouvelles métriques enrichies
  averageHeartrate?: number // FC moyenne sur les activités
  averageCadence?: number // Cadence moyenne (spm)
  averageSpeedKmh?: number // Vitesse moyenne (km/h)
  restRatio?: number // Ratio temps pause / temps total (élapsed vs moving)
  sufferScore?: number // Suffer Score moyen
  trailRunRatio?: number // Ratio TrailRun vs Run (technicité du terrain)
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
