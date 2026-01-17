import type { VercelRequest, VercelResponse } from '@vercel/node'

/**
 * Endpoint API pour récupérer les performances d'un coureur sur une route Strava
 * Récupère les activités qui ont utilisé cette route et extrait les temps sur les segments critiques
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

  const routeId = req.query.route_id as string

  if (!routeId) {
    return res.status(400).json({ error: 'Missing route_id parameter' })
  }

  try {
    // 1. Récupérer les détails de la route et ses segments
    const routeResponse = await fetch(`https://www.strava.com/api/v3/routes/${routeId}`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    })

      if (!routeResponse.ok) {
        if (routeResponse.status === 401) {
          return res.status(401).json({ error: 'Token expired or invalid' })
        }
        if (routeResponse.status === 404) {
          return res.status(404).json({ error: 'Route not found' })
        }
        if (routeResponse.status === 429) {
          // Rate limit atteint
          const retryAfter = routeResponse.headers.get('Retry-After') || '60'
          return res.status(429).json({
            error: 'Rate limit exceeded',
            retryAfter: parseInt(retryAfter, 10),
            message: 'Limite de requêtes Strava atteinte. Veuillez réessayer plus tard.',
          })
        }
        const errorText = await routeResponse.text()
        return res.status(routeResponse.status).json({ error: errorText })
      }

    const route = await routeResponse.json()

    // 2. Récupérer les segments de la route (via segments/explore)
    const routeSegments: Array<{ id: number; name: string }> = []
    
    if (route.map?.polyline) {
      try {
        const bounds = decodePolyline(route.map.polyline)
        if (bounds && bounds.length > 0) {
          const lats = bounds.map((p) => p.lat)
          const lons = bounds.map((p) => p.lon)
          const minLat = Math.min(...lats)
          const maxLat = Math.max(...lats)
          const minLon = Math.min(...lons)
          const maxLon = Math.max(...lons)

          const exploreResponse = await fetch(
            `https://www.strava.com/api/v3/segments/explore?bounds=${minLat},${minLon},${maxLat},${maxLon}`,
            {
              headers: {
                Authorization: `Bearer ${accessToken}`,
              },
            }
          )

          if (exploreResponse.ok) {
            const exploreData = await exploreResponse.json()
            const rawSegments = exploreData.segments || []
            routeSegments.push(...rawSegments.map((seg: any) => ({ id: seg.id, name: seg.name })))
          }
        }
      } catch (error) {
        console.error('Erreur lors de la récupération des segments:', error)
      }
    }

    // 3. Récupérer les activités du coureur des 12 derniers mois
    const activities: Array<{
      id: number
      name: string
      start_date: string
      distance: number
      moving_time: number
      total_elevation_gain: number
      segment_efforts?: Array<{
        segment: { id: number; name: string }
        elapsed_time: number
        distance: number
        average_grade: number
      }>
    }> = []

    const twelveMonthsAgo = Date.now() - 12 * 30 * 24 * 60 * 60 * 1000
    let page = 1
    const perPage = 200
    const maxPages = 3 // Limiter à 3 pages (600 activités max) pour éviter trop de requêtes
    const maxActivitiesToProcess = 10 // Limiter le nombre d'activités à traiter en détail

    while (page <= maxPages) {
      const activitiesResponse = await fetch(
        `https://www.strava.com/api/v3/athlete/activities?page=${page}&per_page=${perPage}`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      )

      if (!activitiesResponse.ok) {
        if (activitiesResponse.status === 401) {
          return res.status(401).json({ error: 'Token expired or invalid' })
        }
        if (activitiesResponse.status === 429) {
          // Rate limit atteint
          const retryAfter = activitiesResponse.headers.get('Retry-After') || '60'
          return res.status(429).json({
            error: 'Rate limit exceeded',
            retryAfter: parseInt(retryAfter, 10),
            message: 'Limite de requêtes Strava atteinte. Veuillez réessayer plus tard.',
          })
        }
        break
      }

      const pageActivities = await activitiesResponse.json()
      if (pageActivities.length === 0) break

      // Filtrer les activités de course dans les 12 derniers mois
      const filtered = pageActivities.filter((act: any) => {
        const activityDate = new Date(act.start_date).getTime()
        return act.type === 'Run' && activityDate >= twelveMonthsAgo
      })

      // Pour chaque activité, récupérer les segment efforts (limité pour éviter trop d'appels)
      for (const activity of filtered.slice(0, maxActivitiesToProcess)) {
        // Si on a déjà assez d'activités, arrêter
        if (activities.length >= maxActivitiesToProcess) break

        try {
          const activityDetailsResponse = await fetch(
            `https://www.strava.com/api/v3/activities/${activity.id}?include_all_efforts=true`,
            {
              headers: {
                Authorization: `Bearer ${accessToken}`,
              },
            }
          )

          if (!activityDetailsResponse.ok) {
            if (activityDetailsResponse.status === 429) {
              // Rate limit atteint, arrêter le traitement
              console.warn('Rate limit atteint lors de la récupération des détails d\'activité')
              break
            }
            continue
          }

          const activityDetails = await activityDetailsResponse.json()
          const segmentEfforts = activityDetails.segment_efforts || []

          // Filtrer les segments qui correspondent à la route
          const matchingEfforts = segmentEfforts
            .filter((effort: any) => routeSegments.some((seg) => seg.id === effort.segment.id))
            .map((effort: any) => ({
              segment: {
                id: effort.segment.id,
                name: effort.segment.name,
              },
              elapsed_time: effort.elapsed_time,
              distance: effort.distance,
              average_grade: effort.segment.average_grade || 0,
            }))

          if (matchingEfforts.length > 0) {
            activities.push({
              id: activity.id,
              name: activity.name,
              start_date: activity.start_date,
              distance: activity.distance,
              moving_time: activity.moving_time,
              total_elevation_gain: activity.total_elevation_gain,
              segment_efforts: matchingEfforts,
            })
          }
        } catch (error) {
          console.error(`Erreur lors de la récupération de l'activité ${activity.id}:`, error)
        }
      }

      // Si on a déjà assez d'activités, arrêter la pagination
      if (activities.length >= maxActivitiesToProcess) break

      const lastActivityDate = new Date(pageActivities[pageActivities.length - 1].start_date).getTime()
      if (lastActivityDate < twelveMonthsAgo) break

      page += 1
    }

    // 4. Analyser les performances par segment
    const segmentPerformance: Record<
      number,
      {
        segment_id: number
        segment_name: string
        best_time: number | null
        average_time: number | null
        attempts: number
        last_attempt_date: string | null
      }
    > = {}

    activities.forEach((activity) => {
      activity.segment_efforts?.forEach((effort) => {
        const segId = effort.segment.id
        if (!segmentPerformance[segId]) {
          segmentPerformance[segId] = {
            segment_id: segId,
            segment_name: effort.segment.name,
            best_time: null,
            average_time: null,
            attempts: 0,
            last_attempt_date: null,
          }
        }

        const perf = segmentPerformance[segId]
        perf.attempts += 1
        if (!perf.best_time || effort.elapsed_time < perf.best_time) {
          perf.best_time = effort.elapsed_time
        }
        perf.last_attempt_date = activity.start_date

        // Calculer la moyenne
        if (!perf.average_time) {
          perf.average_time = effort.elapsed_time
        } else {
          perf.average_time = (perf.average_time * (perf.attempts - 1) + effort.elapsed_time) / perf.attempts
        }
      })
    })

    return res.status(200).json({
      route: {
        id: route.id,
        name: route.name,
        distance: route.distance,
        elevation_gain: route.elevation_gain,
      },
      activities_count: activities.length,
      segment_performance: Object.values(segmentPerformance),
    })
  } catch (error) {
    console.error('Erreur lors de la récupération des performances:', error)
    return res.status(500).json({ error: 'Failed to fetch route performance' })
  }
}

/**
 * Décode un polyline Google Maps en points lat/lon
 */
function decodePolyline(encoded: string): Array<{ lat: number; lon: number }> {
  const points: Array<{ lat: number; lon: number }> = []
  let index = 0
  const len = encoded.length
  let lat = 0
  let lon = 0

  while (index < len) {
    let b
    let shift = 0
    let result = 0
    do {
      b = encoded.charCodeAt(index++) - 63
      result |= (b & 0x1f) << shift
      shift += 5
    } while (b >= 0x20)
    const dlat = (result & 1) !== 0 ? ~(result >> 1) : result >> 1
    lat += dlat

    shift = 0
    result = 0
    do {
      b = encoded.charCodeAt(index++) - 63
      result |= (b & 0x1f) << shift
      shift += 5
    } while (b >= 0x20)
    const dlon = (result & 1) !== 0 ? ~(result >> 1) : result >> 1
    lon += dlon

    points.push({ lat: lat * 1e-5, lon: lon * 1e-5 })
  }

  return points
}
