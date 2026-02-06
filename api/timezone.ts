import type { VercelRequest, VercelResponse } from '@vercel/node'

/**
 * Retourne l'heure actuelle dans la région (timezone) des coordonnées.
 * GET /api/timezone?lat=...&lon=...
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
    return res.status(400).json({ error: 'Paramètres lat et lon requis et valides' })
  }

  try {
    const { find } = await import('geo-tz')
    const zones = find(latNum, lonNum)
    const timezone = zones && zones.length > 0 ? zones[0] : 'UTC'
    const now = new Date()
    const formatter = new Intl.DateTimeFormat('fr-FR', {
      timeZone: timezone,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    })
    const time = formatter.format(now)
    const timeShort = time.replace(':', 'h')
    // Décalage UTC en heures (ex. +4, -2) pour affichage "22h06 (+4h)"
    let offsetHours: number = 0
    try {
      const parts = new Intl.DateTimeFormat('en-US', {
        timeZone: timezone,
        timeZoneName: 'longOffset',
      }).formatToParts(now)
      const tzPart = parts.find((p) => p.type === 'timeZoneName')
      const value = tzPart?.value ?? ''
      const match = value.match(/GMT([+-])(\d+)(?::(\d+))?/)
      if (match) {
        const sign = match[1] === '+' ? 1 : -1
        const h = parseInt(match[2], 10)
        const m = match[3] ? parseInt(match[3], 10) : 0
        offsetHours = sign * (h + m / 60)
      }
    } catch {
      // garder 0
    }
    res.setHeader('Cache-Control', 'public, max-age=60')
    return res.status(200).json({ timezone, time: timeShort, offsetHours })
  } catch (err) {
    console.error('Erreur timezone', err)
    const formatter = new Intl.DateTimeFormat('fr-FR', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    })
    const timeShort = formatter.format(new Date()).replace(':', 'h')
    return res.status(200).json({ timezone: 'UTC', time: timeShort, offsetHours: 0 })
  }
}
