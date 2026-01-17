import type { StravaActivity, StravaMetrics } from '../types/strava'

type WeekBucket = {
  start: number
  km: number
  dplus: number
  count: number
  longRunKm: number
  longRunDPlus: number
}

// Calcule les bornes des 6 dernières semaines glissantes
function buildWeekBuckets(reference: Date): WeekBucket[] {
  const buckets: WeekBucket[] = []
  for (let i = 0; i < 6; i += 1) {
    const end = new Date(reference)
    end.setUTCDate(reference.getUTCDate() - i * 7)
    end.setUTCHours(23, 59, 59, 999)
    const start = new Date(end)
    start.setUTCDate(end.getUTCDate() - 6)
    start.setUTCHours(0, 0, 0, 0)
    buckets.unshift({
      start: start.getTime(),
      km: 0,
      dplus: 0,
      count: 0,
      longRunKm: 0,
      longRunDPlus: 0,
    })
  }
  return buckets
}

function pickBucket(buckets: WeekBucket[], date: Date) {
  const ts = date.getTime()
  return buckets.find((bucket, idx) => {
    const endTs = idx === buckets.length - 1 ? Number.MAX_SAFE_INTEGER : buckets[idx + 1].start - 1
    return ts >= bucket.start && ts <= endTs
  })
}

function formatRegularity(avgCount: number): StravaMetrics['regularity'] {
  if (avgCount >= 4) return 'bonne'
  if (avgCount >= 2) return 'moyenne'
  return 'faible'
}

function computeVariation(latest: WeekBucket, previous: WeekBucket | undefined): number {
  if (!previous || previous.km + previous.dplus === 0) return 0
  const currentLoad = latest.km + latest.dplus
  const prevLoad = previous.km + previous.dplus
  return ((currentLoad - prevLoad) / prevLoad) * 100
}

export function computeStravaMetrics(activities: StravaActivity[]): StravaMetrics {
  const now = new Date()
  const buckets = buildWeekBuckets(now)

  activities.forEach((act) => {
    const d = new Date(act.date)
    const bucket = pickBucket(buckets, d)
    if (!bucket) return
    bucket.km += act.distanceKm
    bucket.dplus += act.elevationGain
    bucket.count += 1
    if (act.distanceKm > bucket.longRunKm) bucket.longRunKm = act.distanceKm
    if (act.elevationGain > bucket.longRunDPlus) bucket.longRunDPlus = act.elevationGain
  })

  const last = buckets[buckets.length - 1]
  const prev = buckets[buckets.length - 2]
  const kmPerWeek = Math.round(last.km)
  const dPlusPerWeek = Math.round(last.dplus)
  const longRunDistanceKm = Math.round(last.longRunKm || 0)
  const longRunDPlus = Math.round(last.longRunDPlus || 0)
  const avgCount = buckets.reduce((acc, b) => acc + b.count, 0) / buckets.length
  const regularity = formatRegularity(avgCount)
  const variation = computeVariation(last, prev)

  const loadScore = Math.round(last.km * 10 + last.dplus * 0.3)
  const loadDelta = Math.round(variation * 10) / 10

  const recommendations: string[] = []
  if (longRunDistanceKm < 20) recommendations.push('ajouter 2 sorties > 4h')
  if (dPlusPerWeek < 2800) recommendations.push('augmenter le travail en descente')
  recommendations.push('tester nutrition sur effort long')
  const targetDPlusPerWeek = 2800

  return {
    kmPerWeek,
    dPlusPerWeek,
    longRunDistanceKm,
    longRunDPlus,
    regularity,
    variation,
    loadScore,
    loadDelta,
    recommendations,
    targetDPlusPerWeek,
  }
}
