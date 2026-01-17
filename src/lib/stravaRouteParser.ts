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
