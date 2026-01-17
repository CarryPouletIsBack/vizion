import type { VercelRequest, VercelResponse } from '@vercel/node'

/**
 * Endpoint API pour récupérer les détails d'une activité Strava spécifique
 * Utile pour analyser une activité de référence (ex: un entraînement sur le parcours)
 * 
 * Les embeds Strava ne permettent pas de récupérer des données directement,
 * mais on peut utiliser l'API Strava avec l'ID d'activité pour obtenir toutes les infos
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

  const activityId = req.query.activity_id as string

  if (!activityId) {
    return res.status(400).json({ error: 'Missing activity_id parameter' })
  }

  try {
    // Récupérer les détails de l'activité
    const activityResponse = await fetch(`https://www.strava.com/api/v3/activities/${activityId}`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    })

    if (!activityResponse.ok) {
      if (activityResponse.status === 401) {
        return res.status(401).json({ error: 'Token expired or invalid' })
      }
      if (activityResponse.status === 404) {
        return res.status(404).json({ error: 'Activity not found' })
      }
      const errorText = await activityResponse.text()
      return res.status(activityResponse.status).json({ error: errorText })
    }

    const activity = await activityResponse.json()

    // Récupérer les streams (données détaillées) si disponibles
    let streams: any = null
    try {
      const streamsResponse = await fetch(
        `https://www.strava.com/api/v3/activities/${activityId}/streams?keys=time,distance,altitude,heartrate,velocity_smooth&key_by_type=true`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      )

      if (streamsResponse.ok) {
        streams = await streamsResponse.json()
      }
    } catch (error) {
      console.warn('Impossible de récupérer les streams:', error)
      // Les streams ne sont pas critiques, on continue sans
    }

    // Retourner les données formatées
    return res.status(200).json({
      id: activity.id,
      name: activity.name,
      type: activity.type,
      start_date: activity.start_date,
      distance: activity.distance, // en mètres
      moving_time: activity.moving_time, // en secondes
      elapsed_time: activity.elapsed_time, // en secondes
      total_elevation_gain: activity.total_elevation_gain, // en mètres
      average_speed: activity.average_speed, // en m/s
      max_speed: activity.max_speed, // en m/s
      average_heartrate: activity.average_heartrate,
      max_heartrate: activity.max_heartrate,
      calories: activity.calories,
      // Données de la route si disponible
      map: activity.map,
      // Streams (données détaillées point par point)
      streams,
    })
  } catch (error) {
    console.error('Erreur lors de la récupération de l\'activité Strava:', error)
    return res.status(500).json({ error: 'Failed to fetch activity details' })
  }
}
