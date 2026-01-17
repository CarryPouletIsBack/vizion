import type { VercelRequest, VercelResponse } from '@vercel/node'

/**
 * Endpoint API pour récupérer les activités Strava de l'utilisateur
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

  try {
    // Récupérer les activités Strava (8-12 semaines glissantes)
    const perPage = 200 // Maximum par page
    const activities: any[] = []
    let page = 1
    const now = Date.now()
    const twelveWeeksAgo = now - 12 * 7 * 24 * 60 * 60 * 1000

    // Récupérer toutes les activités des 12 dernières semaines
    while (true) {
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
        const errorText = await response.text()
        return res.status(response.status).json({ error: errorText })
      }

      const pageActivities = await response.json()

      if (pageActivities.length === 0) break

      // Filtrer uniquement les activités running et celles des 12 dernières semaines
      const filtered = pageActivities.filter((act: any) => {
        const activityDate = new Date(act.start_date).getTime()
        return act.type === 'Run' && activityDate >= twelveWeeksAgo
      })

      activities.push(...filtered)

      // Si on a moins de perPage résultats, on a atteint la fin
      if (pageActivities.length < perPage) break

      // Si la dernière activité est plus ancienne que 12 semaines, on arrête
      const lastActivityDate = new Date(pageActivities[pageActivities.length - 1].start_date).getTime()
      if (lastActivityDate < twelveWeeksAgo) break

      page += 1
    }

    // Transformer les activités au format attendu
    const formattedActivities = activities.map((act) => ({
      id: String(act.id),
      date: act.start_date,
      distanceKm: act.distance / 1000, // Convertir mètres en km
      elevationGain: act.total_elevation_gain || 0,
      movingTimeSec: act.moving_time || 0,
    }))

    return res.status(200).json({ activities: formattedActivities })
  } catch (error) {
    console.error('Erreur lors de la récupération des activités Strava:', error)
    return res.status(500).json({ error: 'Failed to fetch activities' })
  }
}
