/**
 * Configuration et fonctions pour l'authentification Strava OAuth
 */

// Configuration Strava (variables d'environnement Vercel)
// Les variables sont accessibles via les endpoints API Vercel
const STRAVA_REDIRECT_URI = `${window.location.origin}/auth/strava/callback`

// Fallback pour le développement local
const LOCAL_CLIENT_ID = import.meta.env.VITE_STRAVA_CLIENT_ID || import.meta.env.STRAVA_CLIENT_ID

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
  let clientId: string | undefined

  // En développement local, utiliser directement la variable d'environnement
  if (LOCAL_CLIENT_ID) {
    clientId = LOCAL_CLIENT_ID
  } else {
    // En production, récupérer depuis l'endpoint API Vercel
    try {
      const response = await fetch('/api/strava/config')
      
      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Erreur lors de la récupération de la configuration Strava' }))
        throw new Error(error.error || 'Erreur lors de la récupération de la configuration Strava')
      }

      const config = await response.json()
      clientId = config.client_id
    } catch (error) {
      console.error('Erreur lors de la récupération du client_id:', error)
      throw new Error('Impossible de récupérer STRAVA_CLIENT_ID. Vérifiez vos variables d\'environnement Vercel ou votre fichier .env.local')
    }
  }

  if (!clientId || typeof clientId !== 'string' || clientId.trim() === '') {
    throw new Error('STRAVA_CLIENT_ID non configuré ou invalide. Vérifiez vos variables d\'environnement Vercel ou votre fichier .env.local')
  }

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
