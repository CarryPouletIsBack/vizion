import { useEffect, useMemo, useState } from 'react'

import { computeStravaMetrics } from '../lib/stravaEngine'
import type { StravaActivity, StravaMetrics } from '../types/strava'

const CACHE_KEY = 'trackali:strava-metrics'
const CACHE_TTL_MS = 30 * 60 * 1000 // 30 minutes pour limiter les appels (augmenté de 5 à 30 min)
const TOKEN_KEY = 'trackali:strava_token'

type State = {
  metrics: StravaMetrics | null
  loading: boolean
  error: string | null
}

// Hook qui récupère les activités Strava et calcule les métriques
export default function useStravaMetrics() {
  const [state, setState] = useState<State>({ metrics: null, loading: true, error: null })

  const cached = useMemo(() => {
    try {
      const raw = localStorage.getItem(CACHE_KEY)
      if (!raw) return null
      const parsed = JSON.parse(raw) as { metrics: StravaMetrics; ts: number }
      if (Date.now() - parsed.ts > CACHE_TTL_MS) return null
      return parsed.metrics
    } catch {
      return null
    }
  }, [])

  useEffect(() => {
    // Si on a un cache valide, l'utiliser
    if (cached) {
      setState({ metrics: cached, loading: false, error: null })
      return
    }

    // Récupérer le token depuis localStorage
    let tokenData: { access_token?: string } | null = null
    try {
      const tokenRaw = localStorage.getItem(TOKEN_KEY)
      if (tokenRaw) {
        tokenData = JSON.parse(tokenRaw)
      }
    } catch {
      // Token invalide ou absent
    }

    if (!tokenData?.access_token) {
      // Pas de token : retourner des métriques vides
      const metrics = computeStravaMetrics([])
      setState({ metrics, loading: false, error: 'Non connecté à Strava' })
      return
    }

    // Récupérer les activités depuis l'API Strava
    const fetchActivities = async () => {
      try {
        const response = await fetch('/api/strava/activities', {
          headers: {
            Authorization: `Bearer ${tokenData.access_token}`,
          },
        })

        if (!response.ok) {
          if (response.status === 401) {
            // Token expiré
            localStorage.removeItem(TOKEN_KEY)
            setState({
              metrics: computeStravaMetrics([]),
              loading: false,
              error: 'Token expiré. Veuillez vous reconnecter.',
            })
            return
          }
          throw new Error(`Erreur ${response.status}`)
        }

        const data = await response.json()
        const activities: StravaActivity[] = data.activities || []

        // Calculer les métriques
        const metrics = computeStravaMetrics(activities)

        // Mettre en cache
        try {
          localStorage.setItem(CACHE_KEY, JSON.stringify({ metrics, ts: Date.now() }))
        } catch {
          // ignore
        }

        setState({ metrics, loading: false, error: null })
      } catch (error) {
        console.error('Erreur lors de la récupération des activités Strava:', error)
        setState({
          metrics: computeStravaMetrics([]),
          loading: false,
          error: error instanceof Error ? error.message : 'Erreur inconnue',
        })
      }
    }

    fetchActivities()
  }, [cached])

  return state
}
