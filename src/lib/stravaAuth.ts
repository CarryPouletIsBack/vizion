/**
 * Configuration et fonctions pour l'authentification Strava OAuth
 */

// Configuration Strava (à remplacer par les vraies valeurs depuis les variables d'environnement)
const STRAVA_CLIENT_ID = import.meta.env.VITE_STRAVA_CLIENT_ID || ''
const STRAVA_CLIENT_SECRET = import.meta.env.VITE_STRAVA_CLIENT_SECRET || '' // Ne jamais exposer côté client en production
const STRAVA_REDIRECT_URI =
  import.meta.env.VITE_STRAVA_REDIRECT_URI || `${window.location.origin}/auth/strava/callback`

/**
 * URL d'autorisation Strava
 */
export const STRAVA_AUTH_URL = 'https://www.strava.com/oauth/authorize'

/**
 * URL pour échanger le code contre un token
 */
export const STRAVA_TOKEN_URL = 'https://www.strava.com/oauth/token'

/**
 * Scopes demandés à Strava
 */
export const STRAVA_SCOPES = 'activity:read_all,read_all'

/**
 * Génère l'URL d'autorisation Strava
 */
export function getStravaAuthUrl(): string {
  const params = new URLSearchParams({
    client_id: STRAVA_CLIENT_ID,
    redirect_uri: STRAVA_REDIRECT_URI,
    response_type: 'code',
    scope: STRAVA_SCOPES,
    approval_prompt: 'force',
  })

  return `${STRAVA_AUTH_URL}?${params.toString()}`
}

/**
 * Redirige l'utilisateur vers la page d'autorisation Strava
 */
export function redirectToStravaAuth(): void {
  window.location.href = getStravaAuthUrl()
}

/**
 * Échange le code d'autorisation contre un access token
 * ⚠️ Cette fonction doit être appelée côté serveur pour ne pas exposer le client_secret
 */
export async function exchangeStravaCode(code: string): Promise<{
  access_token: string
  refresh_token: string
  athlete: {
    id: number
    username: string
    firstname: string
    lastname: string
  }
}> {
  // En production, cette fonction doit être appelée depuis un backend
  // qui possède le client_secret
  const response = await fetch('/api/strava/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      code,
      client_id: STRAVA_CLIENT_ID,
      client_secret: STRAVA_CLIENT_SECRET,
    }),
  })

  if (!response.ok) {
    throw new Error('Échec de l\'échange du code Strava')
  }

  return response.json()
}
