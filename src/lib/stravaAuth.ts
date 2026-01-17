/**
 * Configuration et fonctions pour l'authentification Strava OAuth
 */

// Configuration Strava (variables d'environnement Vercel)
// Les variables sont accessibles via les endpoints API Vercel
const STRAVA_REDIRECT_URI = `${window.location.origin}/auth/strava/callback`

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
 * Le client_id est récupéré depuis l'endpoint API
 */
export async function getStravaAuthUrl(): Promise<string> {
  // Récupérer le client_id depuis l'endpoint API (sécurisé)
  const response = await fetch('/api/strava/config')
  const config = await response.json()
  const clientId = config.client_id

  const params = new URLSearchParams({
    client_id: clientId,
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
export async function redirectToStravaAuth(): Promise<void> {
  const authUrl = await getStravaAuthUrl()
  window.location.href = authUrl
}

/**
 * Échange le code d'autorisation contre un access token
 * Appelé via l'endpoint API Vercel sécurisé
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
  const response = await fetch('/api/strava/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ code }),
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Échec de l\'échange du code Strava' }))
    throw new Error(error.error || 'Échec de l\'échange du code Strava')
  }

  return response.json()
}
