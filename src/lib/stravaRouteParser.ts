/**
 * Extrait l'ID de route depuis une URL Strava
 * Exemples :
 * - https://www.strava.com/routes/3344025913460591936
 * - https://strava.com/routes/3344025913460591936
 * - strava.com/routes/3344025913460591936
 */
export function extractRouteIdFromUrl(url: string): string | null {
  if (!url || typeof url !== 'string') return null

  // Nettoyer l'URL
  const cleanUrl = url.trim()

  // Pattern pour extraire l'ID de route
  const patterns = [
    /strava\.com\/routes\/(\d+)/i,
    /\/routes\/(\d+)/,
    /^(\d+)$/, // Si c'est juste l'ID
  ]

  for (const pattern of patterns) {
    const match = cleanUrl.match(pattern)
    if (match && match[1]) {
      return match[1]
    }
  }

  return null
}

/**
 * Valide qu'une URL est une URL Strava route valide
 */
export function isValidStravaRouteUrl(url: string): boolean {
  return extractRouteIdFromUrl(url) !== null
}

/**
 * Extrait l'ID d'activité depuis une URL ou un embed Strava
 * Exemples :
 * - https://www.strava.com/activities/17046591458
 * - strava.com/activities/17046591458
 * - data-embed-id="17046591458" (depuis un embed)
 */
export function extractActivityIdFromUrl(url: string): string | null {
  if (!url || typeof url !== 'string') return null

  const cleanUrl = url.trim()

  // Pattern pour extraire l'ID d'activité
  const patterns = [
    /strava\.com\/activities\/(\d+)/i,
    /\/activities\/(\d+)/,
    /data-embed-id=["'](\d+)["']/i, // Depuis un embed
    /activity_id[=:](\d+)/i,
    /^(\d+)$/, // Si c'est juste l'ID
  ]

  for (const pattern of patterns) {
    const match = cleanUrl.match(pattern)
    if (match && match[1]) {
      return match[1]
    }
  }

  return null
}
