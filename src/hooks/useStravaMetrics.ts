import { useEffect, useMemo, useState } from 'react'

import { computeStravaMetrics } from '../lib/stravaEngine'
import type { StravaMetrics } from '../types/strava'

const CACHE_KEY = 'vizion:strava-metrics'
const CACHE_TTL_MS = 5 * 60 * 1000 // 5 minutes pour limiter les appels

type State = {
  metrics: StravaMetrics | null
  loading: boolean
}

// Hook qui simule un appel Strava, met en cache pour limiter le nombre de requêtes
export default function useStravaMetrics() {
  const [state, setState] = useState<State>({ metrics: null, loading: true })

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
    if (cached) {
      setState({ metrics: cached, loading: false })
      return
    }
    // Pas de mock : on renvoie des métriques vides (en attendant l'API Strava réelle)
    const metrics = computeStravaMetrics([])
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify({ metrics, ts: Date.now() }))
    } catch {
      // ignore
    }
    setState({ metrics, loading: false })
  }, [cached])

  return state
}
