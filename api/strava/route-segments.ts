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
      const errorText = await routeResponse.text()
      return res.status(routeResponse.status).json({ error: errorText })
    }

    const route = await routeResponse.json()

    // Récupérer les segments de la route
    // Note: L'API Strava ne retourne pas directement les segments d'une route
    // Il faut utiliser l'endpoint segments/explore avec les coordonnées de la route
    // Pour l'instant, on retourne les infos de base de la route
    const segments: Array<{
      id: number
      name: string
      distance: number
      elevation_gain: number
      average_grade: number
      type: 'climb' | 'descent' | 'flat'
    }> = []

    // Si la route a des segments dans les données (selon la structure de l'API)
    // On les extrait, sinon on retourne les infos de base
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
