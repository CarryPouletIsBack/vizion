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

    // Récupérer les streams (données détaillées) pour calculer les temps au km si besoin
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
    }

    // Splits au km : utiliser splits_metric de l'API ou calculer depuis les streams
    let splitsPerKm: Array<{ km: number; movingTimeSec: number; elapsedTimeSec: number; paceMinPerKm?: number }> = []
    if (activity.splits_metric && Array.isArray(activity.splits_metric) && activity.splits_metric.length > 0) {
      splitsPerKm = activity.splits_metric.map((split: any, index: number) => ({
        km: index + 1,
        movingTimeSec: split.moving_time || 0,
        elapsedTimeSec: split.elapsed_time || split.moving_time || 0,
        paceMinPerKm: split.moving_time && split.distance
          ? (split.moving_time / 60) / (split.distance / 1000)
          : undefined,
      }))
    } else if (streams?.distance?.data && streams?.time?.data) {
      const dist = streams.distance.data as number[]
      const time = streams.time.data as number[]
      const totalKm = (activity.distance || 0) / 1000
      for (let km = 1; km <= Math.floor(totalKm); km++) {
        const targetM = km * 1000
        const idxEnd = dist.findIndex((d: number) => d >= targetM)
        if (idxEnd === -1) break
        const idxStart = km === 1 ? 0 : dist.findIndex((d: number) => d >= (km - 1) * 1000)
        const elapsedSec = idxStart >= 0 && idxEnd >= 0 ? time[idxEnd] - time[idxStart] : 0
        const distanceM = dist[idxEnd] - (idxStart >= 0 ? dist[idxStart] : 0)
        const pace = distanceM > 0 ? (elapsedSec / 60) / (distanceM / 1000) : undefined
        splitsPerKm.push({
          km,
          movingTimeSec: elapsedSec,
          elapsedTimeSec: elapsedSec,
          paceMinPerKm: pace,
        })
      }
    }

    return res.status(200).json({
      id: activity.id,
      name: activity.name,
      type: activity.type,
      start_date: activity.start_date,
      distance: activity.distance,
      moving_time: activity.moving_time,
      elapsed_time: activity.elapsed_time,
      total_elevation_gain: activity.total_elevation_gain,
      average_speed: activity.average_speed,
      max_speed: activity.max_speed,
      average_heartrate: activity.average_heartrate,
      max_heartrate: activity.max_heartrate,
      calories: activity.calories,
      map: activity.map,
      streams,
      splits_metric: activity.splits_metric || null,
      laps: activity.laps || null,
      splits_per_km: splitsPerKm.length > 0 ? splitsPerKm : null,
    })
  } catch (error) {
    console.error('Erreur lors de la récupération de l\'activité Strava:', error)
    return res.status(500).json({ error: 'Failed to fetch activity details' })
  }
}
