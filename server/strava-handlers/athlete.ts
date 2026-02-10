import type { VercelRequest, VercelResponse } from '@vercel/node'

export async function athleteHandler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method Not Allowed' })
  const authHeader = req.headers.authorization
  const accessToken = authHeader?.replace('Bearer ', '')
  if (!accessToken) return res.status(401).json({ error: 'Missing access token' })
  try {
    const response = await fetch('https://www.strava.com/api/v3/athlete', {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    if (!response.ok) {
      if (response.status === 401) return res.status(401).json({ error: 'Token expired or invalid' })
      if (response.status === 429) {
        const retryAfter = response.headers.get('Retry-After') || '60'
        return res.status(429).json({ error: 'Rate limit exceeded', retryAfter: parseInt(retryAfter, 10), message: 'Limite de requêtes Strava atteinte. Veuillez réessayer plus tard.' })
      }
      return res.status(response.status).json({ error: await response.text() })
    }
    const athlete = await response.json()
    const formattedAthlete = {
      id: String(athlete.id),
      username: athlete.username,
      firstname: athlete.firstname,
      lastname: athlete.lastname,
      city: athlete.city,
      state: athlete.state,
      country: athlete.country,
      sex: athlete.sex,
      premium: athlete.premium || false,
      summit: athlete.summit || false,
      createdAt: athlete.created_at,
      updatedAt: athlete.updated_at,
      followerCount: athlete.follower_count,
      friendCount: athlete.friend_count,
      measurementPreference: athlete.measurement_preference || 'meters',
      ftp: athlete.ftp,
      weight: athlete.weight,
      clubs: athlete.clubs?.map((club: any) => ({ id: String(club.id), name: club.name, profile: club.profile, coverPhoto: club.cover_photo, activityTypes: club.activity_types || [] })) || [],
      bikes: athlete.bikes?.map((bike: any) => ({ id: String(bike.id), name: bike.name, distance: bike.distance || 0, primary: bike.primary || false })) || [],
      shoes: athlete.shoes?.map((shoe: any) => ({ id: String(shoe.id), name: shoe.name, distance: shoe.distance || 0, primary: shoe.primary || false })) || [],
    }
    return res.status(200).json({ athlete: formattedAthlete })
  } catch (error) {
    console.error('Erreur lors de la récupération des infos athlète Strava:', error)
    return res.status(500).json({ error: 'Failed to fetch athlete' })
  }
}
