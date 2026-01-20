import type { VercelRequest, VercelResponse } from '@vercel/node'

/**
 * Endpoint API pour récupérer les informations de l'athlète Strava
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
    // Récupérer les infos de l'athlète
    const response = await fetch('https://www.strava.com/api/v3/athlete', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    })

    if (!response.ok) {
      if (response.status === 401) {
        return res.status(401).json({ error: 'Token expired or invalid' })
      }
      if (response.status === 429) {
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

    const athlete = await response.json()

    // Transformer les données au format attendu
    const formattedAthlete = {
      id: String(athlete.id),
      username: athlete.username || undefined,
      firstname: athlete.firstname || undefined,
      lastname: athlete.lastname || undefined,
      city: athlete.city || undefined,
      state: athlete.state || undefined,
      country: athlete.country || undefined,
      sex: athlete.sex || undefined, // M, F
      premium: athlete.premium || false,
      summit: athlete.summit || false,
      createdAt: athlete.created_at || undefined,
      updatedAt: athlete.updated_at || undefined,
      followerCount: athlete.follower_count || undefined,
      friendCount: athlete.friend_count || undefined,
      measurementPreference: athlete.measurement_preference || 'meters', // meters, feet
      ftp: athlete.ftp || undefined, // Functional Threshold Power
      weight: athlete.weight || undefined, // kg
      clubs: athlete.clubs?.map((club: any) => ({
        id: String(club.id),
        name: club.name,
        profile: club.profile || undefined,
        coverPhoto: club.cover_photo || undefined,
        activityTypes: club.activity_types || [],
      })) || [],
      bikes: athlete.bikes?.map((bike: any) => ({
        id: String(bike.id),
        name: bike.name,
        distance: bike.distance || 0, // mètres
        primary: bike.primary || false,
      })) || [],
      shoes: athlete.shoes?.map((shoe: any) => ({
        id: String(shoe.id),
        name: shoe.name,
        distance: shoe.distance || 0, // mètres
        primary: shoe.primary || false,
      })) || [],
    }

    return res.status(200).json({ athlete: formattedAthlete })
  } catch (error) {
    console.error('Erreur lors de la récupération des infos athlète Strava:', error)
    return res.status(500).json({ error: 'Failed to fetch athlete' })
  }
}
