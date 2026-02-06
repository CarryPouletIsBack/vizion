import type { VercelRequest, VercelResponse } from '@vercel/node'

const XWEATHER_BASE = 'https://api.aerisapi.com'
const CACHE_TTL_SECONDS = 4 * 60 * 60 // 4 heures

/**
 * Route API météo (Xweather / Aeris).
 * Appelée par le client avec lat, lon. Les clés API restent côté serveur.
 * Réduit les requêtes grâce au cache client 4h.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method Not Allowed' })
  }

  const lat = req.query.lat as string
  const lon = req.query.lon as string
  const latNum = lat != null ? parseFloat(lat) : NaN
  const lonNum = lon != null ? parseFloat(lon) : NaN

  if (Number.isNaN(latNum) || Number.isNaN(lonNum) || latNum < -90 || latNum > 90 || lonNum < -180 || lonNum > 180) {
    return res.status(400).json({ error: 'Paramètres lat et lon requis et valides (lat -90..90, lon -180..180)' })
  }

  const clientId = process.env.XWEATHER_CLIENT_ID
  const clientSecret = process.env.XWEATHER_CLIENT_SECRET

  if (!clientId || !clientSecret) {
    console.error('XWEATHER_CLIENT_ID ou XWEATHER_CLIENT_SECRET non configurés')
    return res.status(500).json({
      error: 'Météo non configurée',
      message: 'Variables XWEATHER_CLIENT_ID et XWEATHER_CLIENT_SECRET requises (Vercel).',
    })
  }

  try {
    const url = `${XWEATHER_BASE}/observations/closest?p=${latNum},${lonNum}&client_id=${encodeURIComponent(clientId)}&client_secret=${encodeURIComponent(clientSecret)}`
    const response = await fetch(url, { headers: { Accept: 'application/json' } })

    if (!response.ok) {
      const text = await response.text()
      console.error('Xweather API error', response.status, text)
      return res.status(502).json({
        error: 'Erreur API météo',
        status: response.status,
      })
    }

    const data = (await response.json()) as {
      success?: boolean
      response?: Array<{
        ob?: {
          tempC?: number
          temp?: number
          icon?: string
          weather?: string
          precipMM?: number
          precipIN?: number
          precipTodayMM?: number
          precipTodayIN?: number
        }
      }>
      error?: { description?: string }
    }

    if (!data.success && data.error) {
      console.error('Xweather API error', data.error)
      return res.status(502).json({
        error: 'Erreur API météo',
        message: data.error.description ?? 'Réponse invalide',
      })
    }

    const ob = data.response?.[0]?.ob
    const tempC = ob?.tempC ?? ob?.temp ?? null
    const icon = ob?.icon ?? ob?.weather ?? undefined
    const precipMM = ob?.precipTodayMM ?? ob?.precipMM ?? (ob?.precipTodayIN != null ? ob.precipTodayIN * 25.4 : undefined) ?? (ob?.precipIN != null ? ob.precipIN * 25.4 : undefined)
    const rainLast24h = precipMM != null ? precipMM > 0 : undefined

    if (tempC == null) {
      return res.status(502).json({
        error: 'Données météo incomplètes',
        message: 'Température non disponible pour ce point.',
      })
    }

    res.setHeader('Cache-Control', `public, max-age=${CACHE_TTL_SECONDS}, s-maxage=${CACHE_TTL_SECONDS}`)
    return res.status(200).json({
      tempC: Number(tempC),
      icon: icon ?? undefined,
      rainLast24h: rainLast24h ?? undefined,
    })
  } catch (err) {
    console.error('Erreur météo', err)
    return res.status(500).json({
      error: 'Erreur serveur météo',
      message: err instanceof Error ? err.message : 'Erreur inconnue',
    })
  }
}
