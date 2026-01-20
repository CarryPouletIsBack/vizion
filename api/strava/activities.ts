import type { VercelRequest, VercelResponse } from '@vercel/node'

/**
 * Endpoint API pour récupérer les activités Strava de l'utilisateur
 * Utilise le token stocké dans la requête (via Authorization header)
 * 
 * Gestion des rate limits Strava :
 * - 100 requêtes / 15 minutes
 * - 1000 requêtes / jour
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method Not Allowed' })
  }

  // Récupérer le token depuis l'Authorization header
  const authHeader = req.headers.authorization
  const accessToken = authHeader?.replace('Bearer ', '')

  if (!accessToken) {
    return res.status(401).json({ error: 'Missing access token' })
  }

  try {
    // Récupérer les activités Strava (8-12 semaines glissantes)
    const perPage = 200 // Maximum par page
    const activities: any[] = []
    let page = 1
    const now = Date.now()
    const twelveWeeksAgo = now - 12 * 7 * 24 * 60 * 60 * 1000
    const maxPages = 5 // Limiter à 5 pages max pour éviter trop d'appels (1000 activités max)

    // Récupérer toutes les activités des 12 dernières semaines
    while (page <= maxPages) {
      const response = await fetch(
        `https://www.strava.com/api/v3/athlete/activities?page=${page}&per_page=${perPage}`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      )

      if (!response.ok) {
        if (response.status === 401) {
          return res.status(401).json({ error: 'Token expired or invalid' })
        }
        if (response.status === 429) {
          // Rate limit atteint
          const retryAfter = response.headers.get('Retry-After') || '60'
          return res.status(429).json({
            error: 'Rate limit exceeded',
            retryAfter: parseInt(retryAfter, 10),
            message: 'Limite de requêtes Strava atteinte. Veuillez réessayer plus tard.',
          })
        }
        const errorText = await response.text()
        return res.status(response.status).json({ error: errorText })
      }

      // Vérifier les headers de rate limit
      const rateLimitLimit = response.headers.get('X-RateLimit-Limit')
      const rateLimitUsage = response.headers.get('X-RateLimit-Usage')
      if (rateLimitLimit && rateLimitUsage) {
        const usage = parseInt(rateLimitUsage.split(',')[0], 10) // Premier nombre = usage sur 15 min
        const limit = parseInt(rateLimitLimit.split(',')[0], 10)
        if (usage >= limit * 0.9) {
          // On approche de la limite, on arrête ici
          console.warn(`Rate limit Strava approché: ${usage}/${limit}`)
          break
        }
      }

      const pageActivities = await response.json()

      if (pageActivities.length === 0) break

      // Filtrer uniquement les activités running/trail et celles des 12 dernières semaines
      const filtered = pageActivities.filter((act: any) => {
        const activityDate = new Date(act.start_date).getTime()
        return (act.type === 'Run' || act.sport_type === 'Run' || act.sport_type === 'TrailRun') && activityDate >= twelveWeeksAgo
      })

      activities.push(...filtered)

      // Si on a moins de perPage résultats, on a atteint la fin
      if (pageActivities.length < perPage) break

      // Si la dernière activité est plus ancienne que 12 semaines, on arrête
      const lastActivityDate = new Date(pageActivities[pageActivities.length - 1].start_date).getTime()
      if (lastActivityDate < twelveWeeksAgo) break

      page += 1
    }

    // Transformer les activités au format attendu avec données enrichies
    const formattedActivities = activities.map((act) => {
      // Calculer la vitesse moyenne (km/h)
      const movingTimeHours = (act.moving_time || 0) / 3600
      const distanceKm = (act.distance || 0) / 1000
      const averageSpeedKmh = movingTimeHours > 0 ? distanceKm / movingTimeHours : 0
      
      // Calculer la vitesse max (km/h)
      const maxSpeedKmh = act.max_speed ? act.max_speed * 3.6 : undefined // m/s -> km/h

      return {
        id: String(act.id),
        date: act.start_date,
        distanceKm,
        elevationGain: act.total_elevation_gain || 0,
        movingTimeSec: act.moving_time || 0,
        elapsedTimeSec: act.elapsed_time || act.moving_time || 0,
        averageSpeedKmh: averageSpeedKmh > 0 ? Math.round(averageSpeedKmh * 10) / 10 : undefined,
        maxSpeedKmh: maxSpeedKmh ? Math.round(maxSpeedKmh * 10) / 10 : undefined,
        averageHeartrate: act.average_heartrate || undefined,
        maxHeartrate: act.max_heartrate || undefined,
        averageCadence: act.average_cadence || undefined,
        calories: act.calories || undefined,
        sufferScore: act.suffer_score || undefined,
        achievementCount: act.achievement_count || undefined,
        prCount: act.pr_count || undefined,
        kudosCount: act.kudos_count || undefined,
        type: act.type || act.sport_type || 'Run',
        name: act.name || undefined,
        // Nouvelles données enrichies
        description: act.description || undefined,
        timezone: act.timezone || undefined,
        utcOffset: act.utc_offset || undefined,
        startLatlng: act.start_latlng || undefined, // [lat, lng]
        endLatlng: act.end_latlng || undefined,
        startLocation: act.start_latlng ? `${act.start_latlng[0]},${act.start_latlng[1]}` : undefined,
        achievementCountDetails: act.achievement_count || 0,
        kudosCountDetails: act.kudos_count || 0,
        commentCount: act.comment_count || 0,
        athleteCount: act.athlete_count || undefined,
        trainer: act.trainer || false,
        commute: act.commute || false,
        manual: act.manual || false,
        private: act.private || false,
        flagged: act.flagged || false,
        workoutType: act.workout_type || undefined, // 0=default, 1=race, 2=long run, 3=workout
        gearId: act.gear_id ? String(act.gear_id) : undefined,
        averageWatts: act.average_watts || undefined,
        weightedAverageWatts: act.weighted_average_watts || undefined,
        kilojoules: act.kilojoules || undefined,
        deviceWatts: act.device_watts || undefined,
        hasHeartrate: act.has_heartrate || false,
        hasKudoed: act.has_kudoed || false,
        splitsMetric: act.splits_metric || undefined, // Tableau de splits
        splitsStandard: act.splits_standard || undefined,
        bestEfforts: act.best_efforts?.map((effort: any) => ({
          id: String(effort.id),
          name: effort.name,
          distance: effort.distance || 0,
          movingTime: effort.moving_time || 0,
          elapsedTime: effort.elapsed_time || 0,
          prRank: effort.pr_rank || undefined,
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
