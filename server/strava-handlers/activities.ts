import type { VercelRequest, VercelResponse } from '@vercel/node'

export async function activitiesHandler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method Not Allowed' })
  const authHeader = req.headers.authorization
  const accessToken = authHeader?.replace('Bearer ', '')
  if (!accessToken) return res.status(401).json({ error: 'Missing access token' })
  try {
    const perPage = 200
    const activities: any[] = []
    let page = 1
    const twelveWeeksAgo = Date.now() - 12 * 7 * 24 * 60 * 60 * 1000
    const maxPages = 5
    while (page <= maxPages) {
      const response = await fetch(
        `https://www.strava.com/api/v3/athlete/activities?page=${page}&per_page=${perPage}`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      )
      if (!response.ok) {
        if (response.status === 401) return res.status(401).json({ error: 'Token expired or invalid' })
        if (response.status === 429) {
          const retryAfter = response.headers.get('Retry-After') || '60'
          return res.status(429).json({ error: 'Rate limit exceeded', retryAfter: parseInt(retryAfter, 10), message: 'Limite de requêtes Strava atteinte. Veuillez réessayer plus tard.' })
        }
        return res.status(response.status).json({ error: await response.text() })
      }
      const rateLimitLimit = response.headers.get('X-RateLimit-Limit')
      const rateLimitUsage = response.headers.get('X-RateLimit-Usage')
      if (rateLimitLimit && rateLimitUsage) {
        const usage = parseInt(rateLimitUsage.split(',')[0], 10)
        const limit = parseInt(rateLimitLimit.split(',')[0], 10)
        if (usage >= limit * 0.9) break
      }
      const pageActivities = await response.json()
      if (pageActivities.length === 0) break
      const filtered = pageActivities.filter((act: any) => {
        const activityDate = new Date(act.start_date).getTime()
        return (act.type === 'Run' || act.sport_type === 'Run' || act.sport_type === 'TrailRun') && activityDate >= twelveWeeksAgo
      })
      activities.push(...filtered)
      if (pageActivities.length < perPage) break
      const lastActivityDate = new Date(pageActivities[pageActivities.length - 1].start_date).getTime()
      if (lastActivityDate < twelveWeeksAgo) break
      page += 1
    }
    const formattedActivities = activities.map((act: any) => {
      const movingTimeHours = (act.moving_time || 0) / 3600
      const distanceKm = (act.distance || 0) / 1000
      const averageSpeedKmh = movingTimeHours > 0 ? distanceKm / movingTimeHours : 0
      const maxSpeedKmh = act.max_speed ? act.max_speed * 3.6 : undefined
      return {
        id: String(act.id),
        date: act.start_date,
        distanceKm,
        elevationGain: act.total_elevation_gain || 0,
        movingTimeSec: act.moving_time || 0,
        elapsedTimeSec: act.elapsed_time || act.moving_time || 0,
        averageSpeedKmh: averageSpeedKmh > 0 ? Math.round(averageSpeedKmh * 10) / 10 : undefined,
        maxSpeedKmh: maxSpeedKmh ? Math.round(maxSpeedKmh * 10) / 10 : undefined,
        averageHeartrate: act.average_heartrate,
        maxHeartrate: act.max_heartrate,
        averageCadence: act.average_cadence,
        calories: act.calories,
        sufferScore: act.suffer_score,
        achievementCount: act.achievement_count,
        prCount: act.pr_count,
        kudosCount: act.kudos_count,
        type: act.type || act.sport_type || 'Run',
        name: act.name,
        description: act.description,
        timezone: act.timezone,
        utcOffset: act.utc_offset,
        startLatlng: act.start_latlng,
        endLatlng: act.end_latlng,
        startLocation: act.start_latlng ? `${act.start_latlng[0]},${act.start_latlng[1]}` : undefined,
        achievementCountDetails: act.achievement_count || 0,
        kudosCountDetails: act.kudos_count || 0,
        commentCount: act.comment_count || 0,
        athleteCount: act.athlete_count,
        trainer: act.trainer || false,
        commute: act.commute || false,
        manual: act.manual || false,
        private: act.private || false,
        flagged: act.flagged || false,
        workoutType: act.workout_type,
        gearId: act.gear_id ? String(act.gear_id) : undefined,
        averageWatts: act.average_watts,
        weightedAverageWatts: act.weighted_average_watts,
        kilojoules: act.kilojoules,
        deviceWatts: act.device_watts,
        hasHeartrate: act.has_heartrate || false,
        hasKudoed: act.has_kudoed || false,
        splitsMetric: act.splits_metric,
        splitsStandard: act.splits_standard,
        bestEfforts: act.best_efforts?.map((effort: any) => ({
          id: String(effort.id),
          name: effort.name,
          distance: effort.distance || 0,
          movingTime: effort.moving_time || 0,
          elapsedTime: effort.elapsed_time || 0,
          prRank: effort.pr_rank,
        })) || [],
        segmentEfforts: act.segment_efforts?.map((effort: any) => ({
          id: String(effort.id),
          name: effort.name || effort.segment?.name,
          segmentId: String(effort.segment?.id || effort.segment_id || ''),
          distance: effort.distance || 0,
          movingTime: effort.moving_time || 0,
          averageGrade: effort.segment?.average_grade || 0,
          elevationDifference: effort.segment?.elevation_high - effort.segment?.elevation_low || 0,
        })) || [],
      }
    })
    return res.status(200).json({ activities: formattedActivities })
  } catch (error) {
    console.error('Erreur lors de la récupération des activités Strava:', error)
    return res.status(500).json({ error: 'Failed to fetch activities' })
  }
}
