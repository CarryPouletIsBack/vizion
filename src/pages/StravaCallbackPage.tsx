import { useEffect, useState } from 'react'

import './StravaCallbackPage.css'

type StravaCallbackPageProps = {
  onAuthSuccess?: () => void
}

/**
 * Page de callback pour l'authentification Strava OAuth
 * Cette page est appelée par Strava après l'autorisation de l'utilisateur
 */
export default function StravaCallbackPage({ onAuthSuccess }: StravaCallbackPageProps) {
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const handleCallback = async () => {
      try {
        // Récupérer le code depuis l'URL
        const urlParams = new URLSearchParams(window.location.search)
        const code = urlParams.get('code')
        const error = urlParams.get('error')

        if (error) {
          setError(`Erreur Strava: ${error}`)
          setStatus('error')
          return
        }

        if (!code) {
          setError('Code d\'autorisation manquant')
          setStatus('error')
          return
        }

        // Échanger le code contre un token (via l'endpoint API Vercel)
        const { exchangeStravaCode } = await import('../lib/stravaAuth')
        const tokenData = await exchangeStravaCode(code)
        console.log('Token Strava reçu:', tokenData)

        // TODO: Stocker le token dans Supabase (table users ou sessions)
        // Pour l'instant, on stocke juste dans localStorage (temporaire)
        try {
          localStorage.setItem('trackali:strava_token', JSON.stringify(tokenData))
        } catch (e) {
          console.warn('Impossible de stocker le token Strava', e)
        }

        setStatus('success')
        onAuthSuccess?.()

        // Rediriger vers la page d'accueil après 2 secondes
        setTimeout(() => {
          window.location.href = '/'
        }, 2000)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erreur inconnue')
        setStatus('error')
      }
    }

    handleCallback()
  }, [onAuthSuccess])

  return (
    <div className="strava-callback-page">
      {status === 'loading' && (
        <div className="strava-callback__content">
          <h1>Connexion à Strava...</h1>
          <p>Veuillez patienter pendant que nous finalisons votre connexion.</p>
        </div>
      )}

      {status === 'success' && (
        <div className="strava-callback__content">
          <h1>Connexion réussie !</h1>
          <p>Vous allez être redirigé vers l'accueil.</p>
        </div>
      )}

      {status === 'error' && (
        <div className="strava-callback__content">
          <h1>Erreur de connexion</h1>
          <p>{error}</p>
          <button type="button" onClick={() => (window.location.href = '/')}>
            Retour à l'accueil
          </button>
        </div>
      )}
    </div>
  )
}
