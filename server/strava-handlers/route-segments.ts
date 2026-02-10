import type { VercelRequest, VercelResponse } from '@vercel/node'
import { decodePolyline, calculateElevationGain } from './polyline'

export async function routeSegmentsHandler(req: VercelRequest, res: VercelResponse) {
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
    const segments: Array<{ id: number; name: string; distance: number; elevation_gain: number; average_grade: number; type: 'climb' | 'descent' | 'flat' }> = []
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
            const rawSegments = exploreData.segments || []
            rawSegments.forEach((seg: any) => {
              const elevationGain = seg.elev_profile && Array.isArray(seg.elev_profile)
                ? calculateElevationGain(seg.elev_profile)
                : seg.total_elevation_gain || 0
              const averageGrade = seg.distance > 0 ? (elevationGain / seg.distance) * 100 : 0
              let type: 'climb' | 'descent' | 'flat' = 'flat'
              if (averageGrade > 2) type = 'climb'
              else if (averageGrade < -2) type = 'descent'
              segments.push({
                id: seg.id,
                name: seg.name || `Segment ${seg.id}`,
                distance: seg.distance || 0,
                elevation_gain: Math.round(elevationGain),
                average_grade: Math.round(averageGrade * 10) / 10,
                type,
              })
            })
          }
        }
      } catch (error) {
        console.error('Erreur lors de la récupération des segments:', error)
      }
    }
    return res.status(200).json({
      route: { id: route.id, name: route.name, distance: route.distance, elevation_gain: route.elevation_gain, type: route.type },
      segments,
    })
  } catch (error) {
    console.error('Erreur lors de la récupération des segments Strava:', error)
    return res.status(500).json({ error: 'Failed to fetch route segments' })
  }
}
