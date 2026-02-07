/**
 * Gestion des rate limits Strava
 * Strava limite à :
 * - 100 requêtes / 15 minutes (endpoints non-upload)
 * - 1000 requêtes / jour
 */

const RATE_LIMIT_KEY = 'trackali:strava-rate-limit'
const RATE_LIMIT_WINDOW = 15 * 60 * 1000 // 15 minutes en ms
const MAX_REQUESTS_PER_WINDOW = 90 // On garde une marge de sécurité (90 au lieu de 100)

type RateLimitState = {
  requests: number[]
  dailyCount: number
  dailyReset: number
}

/**
 * Vérifie si on peut faire une requête sans dépasser les limites
 */
export function canMakeRequest(): boolean {
  try {
    const stored = localStorage.getItem(RATE_LIMIT_KEY)
    if (!stored) return true

    const state: RateLimitState = JSON.parse(stored)
    const now = Date.now()

    // Nettoyer les requêtes anciennes (hors de la fenêtre de 15 min)
    const recentRequests = state.requests.filter(
      (timestamp) => now - timestamp < RATE_LIMIT_WINDOW
    )

    // Vérifier la limite de 15 minutes
    if (recentRequests.length >= MAX_REQUESTS_PER_WINDOW) {
      const oldestRequest = Math.min(...recentRequests)
      const waitTime = RATE_LIMIT_WINDOW - (now - oldestRequest)
      console.warn(
        `Rate limit atteint. Attendre ${Math.ceil(waitTime / 1000)} secondes.`
      )
      return false
    }

    // Vérifier la limite quotidienne (si le reset n'a pas encore eu lieu)
    if (now < state.dailyReset && state.dailyCount >= 950) {
      console.warn('Limite quotidienne approchée.')
      return false
    }

    return true
  } catch {
    return true
  }
}

/**
 * Enregistre une requête pour le tracking des rate limits
 */
export function recordRequest(): void {
  try {
    const stored = localStorage.getItem(RATE_LIMIT_KEY)
    const now = Date.now()
    let state: RateLimitState

    if (stored) {
      state = JSON.parse(stored)
      // Nettoyer les requêtes anciennes
      state.requests = state.requests.filter(
        (timestamp) => now - timestamp < RATE_LIMIT_WINDOW
      )
    } else {
      state = {
        requests: [],
        dailyCount: 0,
        dailyReset: now + 24 * 60 * 60 * 1000, // Reset dans 24h
      }
    }

    // Réinitialiser le compteur quotidien si nécessaire
    if (now >= state.dailyReset) {
      state.dailyCount = 0
      state.dailyReset = now + 24 * 60 * 60 * 1000
    }

    // Ajouter la nouvelle requête
    state.requests.push(now)
    state.dailyCount += 1

    localStorage.setItem(RATE_LIMIT_KEY, JSON.stringify(state))
  } catch {
    // Ignorer les erreurs de localStorage
  }
}

/**
 * Retourne le temps d'attente avant de pouvoir faire une nouvelle requête
 */
export function getWaitTime(): number {
  try {
    const stored = localStorage.getItem(RATE_LIMIT_KEY)
    if (!stored) return 0

    const state: RateLimitState = JSON.parse(stored)
    const now = Date.now()

    // Nettoyer les requêtes anciennes
    const recentRequests = state.requests.filter(
      (timestamp) => now - timestamp < RATE_LIMIT_WINDOW
    )

    if (recentRequests.length >= MAX_REQUESTS_PER_WINDOW) {
      const oldestRequest = Math.min(...recentRequests)
      return RATE_LIMIT_WINDOW - (now - oldestRequest)
    }

    return 0
  } catch {
    return 0
  }
}

/**
 * Retourne les statistiques de rate limit
 */
export function getRateLimitStats(): {
  requestsInWindow: number
  dailyCount: number
  waitTime: number
} {
  try {
    const stored = localStorage.getItem(RATE_LIMIT_KEY)
    if (!stored) {
      return { requestsInWindow: 0, dailyCount: 0, waitTime: 0 }
    }

    const state: RateLimitState = JSON.parse(stored)
    const now = Date.now()

    const recentRequests = state.requests.filter(
      (timestamp) => now - timestamp < RATE_LIMIT_WINDOW
    )

    return {
      requestsInWindow: recentRequests.length,
      dailyCount: state.dailyCount,
      waitTime: getWaitTime(),
    }
  } catch {
    return { requestsInWindow: 0, dailyCount: 0, waitTime: 0 }
  }
}
