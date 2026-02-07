import type { VercelRequest, VercelResponse } from '@vercel/node'

/**
 * Retourne l'heure actuelle dans la région (timezone) des coordonnées.
 * GET /api/timezone?lat=...&lon=...
 * - time: heure locale dans la zone (ex. "23h34" à La Réunion)
 * - offsetHours: décalage UTC de la zone (ex. +4 pour Indian/Reunion)
 */
function formatTimeInOffset(offsetHours: number): string {
  const now = new Date()
  const utcMs = now.getTime()
  const localMs = utcMs + offsetHours * 60 * 60 * 1000
  const d = new Date(localMs)
  const h = d.getUTCHours()
  const m = d.getUTCMinutes()
  return `${h.toString().padStart(2, '0')}h${m.toString().padStart(2, '0')}`
}

function getOffsetFromLon(lon: number): number {
  return Math.round((lon / 15) * 2) / 2
}

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

  const now = new Date()
  let timezone = 'UTC'
  let timeShort: string
  let offsetHours: number

  // La Réunion (ex. Diagonale des fous) : forcer Indian/Reunion en prod où Intl peut varier
  const isReunion = latNum >= -21.5 && latNum <= -20.3 && lonNum >= 55.2 && lonNum <= 55.9
  if (isReunion) {
    timezone = 'Indian/Reunion'
    offsetHours = 4
    timeShort = formatTimeInOffset(offsetHours)
  } else {
    try {
      const { find } = await import('geo-tz')
      const zones = find(latNum, lonNum)
      if (zones && zones.length > 0) {
        timezone = zones[0]
      }
    } catch (err) {
      console.warn('geo-tz failed, using longitude fallback:', err)
    }

    try {
      const formatter = new Intl.DateTimeFormat('fr-FR', {
        timeZone: timezone,
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      })
      const time = formatter.format(now)
      timeShort = time.replace(':', 'h')
      const utcH = now.getUTCHours()
      const utcM = now.getUTCMinutes()
      const utcDec = utcH + utcM / 60
      const zoneParts = new Intl.DateTimeFormat('en-US', {
        timeZone: timezone,
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      }).formatToParts(now)
      const zoneH = parseInt(zoneParts.find((p) => p.type === 'hour')?.value ?? '0', 10)
      const zoneM = parseInt(zoneParts.find((p) => p.type === 'minute')?.value ?? '0', 10)
      offsetHours = zoneH + zoneM / 60 - utcDec
      if (offsetHours > 12) offsetHours -= 24
      if (offsetHours < -12) offsetHours += 24
      offsetHours = Math.round(offsetHours * 100) / 100
    } catch {
      offsetHours = getOffsetFromLon(lonNum)
      timeShort = formatTimeInOffset(offsetHours)
    }
  }

  res.setHeader('Cache-Control', 'public, max-age=60')
  return res.status(200).json({ timezone, time: timeShort, offsetHours })
}
