import type { VercelRequest, VercelResponse } from '@vercel/node'
import { decodePolyline } from './polyline'

export async function routePerformanceHandler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method Not Allowed' })
  const authHeader = req.headers.authorization
  const accessToken = authHeader?.replace('Bearer ', '')
  if (!accessToken) return res.status(401).json({ error: 'Missing access token' })
  const routeId = req.query.route_id as string
  if (!routeId) return res.status(400).json({ error: 'Missing route_id parameter' })
  try {
    const routeResponse = await fetch(`https://www.strava.com/api/v3/routes/${routeId}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    if (!routeResponse.ok) {
      if (routeResponse.status === 401) return res.status(401).json({ error: 'Token expired or invalid' })
      if (routeResponse.status === 404) return res.status(404).json({ error: 'Route not found' })
      if (routeResponse.status === 429) {
        const retryAfter = routeResponse.headers.get('Retry-After') || '60'
        return res.status(429).json({ error: 'Rate limit exceeded', retryAfter: parseInt(retryAfter, 10), message: 'Limite de requêtes Strava atteinte. Veuillez réessayer plus tard.' })
      }
      return res.status(routeResponse.status).json({ error: await routeResponse.text() })
    }
    const route = await routeResponse.json()
    const routeSegments: Array<{ id: number; name: string }> = []
    if (route.map?.polyline) {
      try {
        const bounds = decodePolyline(route.map.polyline)
        if (bounds.length > 0) {
          const lats = bounds.map((p) => p.lat)
          const lons = bounds.map((p) => p.lon)
          const minLat = Math.min(...lats)
          const maxLat = Math.max(...lats)
          const minLon = Math.min(...lons)
          const maxLon = Math.max(...lons)
          const exploreResponse = await fetch(
            `https://www.strava.com/api/v3/segments/explore?bounds=${minLat},${minLon},${maxLat},${maxLon}`,
            { headers: { Authorization: `Bearer ${accessToken}` } }
          )
          if (exploreResponse.ok) {
            const exploreData = await exploreResponse.json()
            routeSegments.push(...(exploreData.segments || []).map((seg: any) => ({ id: seg.id, name: seg.name })))
          }
        }
      } catch (error) {
        console.error('Erreur lors de la récupération des segments:', error)
      }
    }
    const activities: Array<{
      id: number
      name: string
      start_date: string
      distance: number
      moving_time: number
      total_elevation_gain: number
      segment_efforts?: Array<{ segment: { id: number; name: string }; elapsed_time: number; distance: number; average_grade: number }>
    }> = []
    const twelveMonthsAgo = Date.now() - 12 * 30 * 24 * 60 * 60 * 1000
    let page = 1
    const perPage = 200
    const maxPages = 3
    const maxActivitiesToProcess = 10
    while (page <= maxPages) {
      const activitiesResponse = await fetch(
        `https://www.strava.com/api/v3/athlete/activities?page=${page}&per_page=${perPage}`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      )
      if (!activitiesResponse.ok) {
        if (activitiesResponse.status === 401) return res.status(401).json({ error: 'Token expired or invalid' })
        if (activitiesResponse.status === 429) {
          const retryAfter = activitiesResponse.headers.get('Retry-After') || '60'
          return res.status(429).json({ error: 'Rate limit exceeded', retryAfter: parseInt(retryAfter, 10), message: 'Limite de requêtes Strava atteinte. Veuillez réessayer plus tard.' })
        }
        break
      }
      const pageActivities = await activitiesResponse.json()
      if (pageActivities.length === 0) break
      const filtered = pageActivities.filter((act: any) => {
        const activityDate = new Date(act.start_date).getTime()
        return act.type === 'Run' && activityDate >= twelveMonthsAgo
      })
      for (const activity of filtered.slice(0, maxActivitiesToProcess)) {
        if (activities.length >= maxActivitiesToProcess) break
        try {
          const activityDetailsResponse = await fetch(
            `https://www.strava.com/api/v3/activities/${activity.id}?include_all_efforts=true`,
            { headers: { Authorization: `Bearer ${accessToken}` } }
          )
          if (!activityDetailsResponse.ok) {
            if (activityDetailsResponse.status === 429) break
            continue
          }
          const activityDetails = await activityDetailsResponse.json()
          const segmentEfforts = activityDetails.segment_efforts || []
          const matchingEfforts = segmentEfforts
            .filter((effort: any) => routeSegments.some((seg) => seg.id === effort.segment.id))
            .map((effort: any) => ({
              segment: { id: effort.segment.id, name: effort.segment.name },
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
      if (activities.length >= maxActivitiesToProcess) break
      const lastActivityDate = new Date(pageActivities[pageActivities.length - 1].start_date).getTime()
      if (lastActivityDate < twelveMonthsAgo) break
      page += 1
    }
    const segmentPerformance: Record<
      number,
      { segment_id: number; segment_name: string; best_time: number | null; average_time: number | null; attempts: number; last_attempt_date: string | null }
    > = {}
    activities.forEach((activity) => {
      activity.segment_efforts?.forEach((effort: any) => {
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
        if (!perf.best_time || effort.elapsed_time < perf.best_time) perf.best_time = effort.elapsed_time
        perf.last_attempt_date = activity.start_date
        if (!perf.average_time) perf.average_time = effort.elapsed_time
        else perf.average_time = (perf.average_time * (perf.attempts - 1) + effort.elapsed_time) / perf.attempts
      })
    })
    return res.status(200).json({
      route: { id: route.id, name: route.name, distance: route.distance, elevation_gain: route.elevation_gain },
      activities_count: activities.length,
      segment_performance: Object.values(segmentPerformance),
    })
  } catch (error) {
    console.error('Erreur lors de la récupération des performances:', error)
    return res.status(500).json({ error: 'Failed to fetch route performance' })
  }
}
