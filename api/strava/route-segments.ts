import type { VercelRequest, VercelResponse } from '@vercel/node'

/**
 * Endpoint API pour récupérer les segments d'une route Strava
 * Utilise le token stocké dans la requête (via Authorization header)
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
    // Récupérer les détails de la route Strava
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

    // Récupérer les segments le long de la route
    // Note: L'API Strava ne retourne pas directement les segments d'une route
    // On utilise segments/explore avec les bounds de la route pour trouver les segments proches
    const segments: Array<{
      id: number
      name: string
      distance: number
      elevation_gain: number
      average_grade: number
      type: 'climb' | 'descent' | 'flat'
    }> = []

    // Si la route a un polyline, on peut explorer les segments dans la zone
    if (route.map?.polyline) {
      try {
        const bounds = decodePolyline(route.map.polyline)

        if (bounds && bounds.length > 0) {
          // Calculer les bounds (min/max lat/lon)
          const lats = bounds.map((p) => p.lat)
          const lons = bounds.map((p) => p.lon)
          const minLat = Math.min(...lats)
          const maxLat = Math.max(...lats)
          const minLon = Math.min(...lons)
          const maxLon = Math.max(...lons)

          // Explorer les segments dans cette zone (format: sw.lat,sw.lon,ne.lat,ne.lon)
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

            // Transformer les segments au format attendu
            rawSegments.forEach((seg: any) => {
              // Calculer le dénivelé depuis le profil d'élévation
              const elevationGain = seg.elev_profile && Array.isArray(seg.elev_profile)
                ? calculateElevationGain(seg.elev_profile)
                : seg.total_elevation_gain || 0

              // Calculer la pente moyenne
              const averageGrade = seg.distance > 0 ? (elevationGain / seg.distance) * 100 : 0

              // Déterminer le type de segment
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
          } else {
            console.warn('Impossible d\'explorer les segments:', await exploreResponse.text())
          }
        }
      } catch (error) {
        console.error('Erreur lors de la récupération des segments:', error)
        // On continue même si l'exploration des segments échoue
      }
    }

    return res.status(200).json({
      route: {
        id: route.id,
        name: route.name,
        distance: route.distance,
        elevation_gain: route.elevation_gain,
        type: route.type,
      },
      segments,
    })
  } catch (error) {
    console.error('Erreur lors de la récupération des segments Strava:', error)
    return res.status(500).json({ error: 'Failed to fetch route segments' })
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

/**
 * Calcule le dénivelé depuis un profil d'élévation
 */
function calculateElevationGain(elevProfile: number[]): number {
  if (!elevProfile || elevProfile.length < 2) return 0
  let gain = 0
  for (let i = 1; i < elevProfile.length; i++) {
    const delta = elevProfile[i] - elevProfile[i - 1]
    if (delta > 0) gain += delta
  }
  return Math.round(gain)
}
