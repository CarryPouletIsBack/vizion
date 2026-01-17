import { useEffect, useState } from 'react'

import './HeaderTopBar.css'

import logoVision from '../assets/c5c94aad0b681f3e62439f66f02703ba7c8b5826.svg'
import { redirectToStravaAuth } from '../lib/stravaAuth'
import LoginModal from './LoginModal'

type HeaderTopBarProps = {
  onNavigate?: (view: 'saison' | 'events' | 'courses' | 'course' | 'account') => void
}

type StravaUser = {
  id: number
  username: string
  firstname: string
  lastname: string
  profile?: string // URL de la photo de profil
}

export default function HeaderTopBar({ onNavigate }: HeaderTopBarProps) {
  const [user, setUser] = useState<StravaUser | null>(null)
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false)
  const [loginModalMode, setLoginModalMode] = useState<'login' | 'signup'>('login')

  // Debug en production
  useEffect(() => {
    console.log('HeaderTopBar - isLoginModalOpen:', isLoginModalOpen, 'loginModalMode:', loginModalMode)
  }, [isLoginModalOpen, loginModalMode])

  useEffect(() => {
    // Récupérer les données de l'utilisateur depuis localStorage
    const loadUser = () => {
      try {
        const tokenData = localStorage.getItem('vizion:strava_token')
        if (tokenData) {
          const parsed = JSON.parse(tokenData)
          if (parsed.athlete) {
            // L'API Strava retourne profile, profile_medium, ou profile_large
            const profileUrl = parsed.athlete.profile || parsed.athlete.profile_medium || parsed.athlete.profile_large
            setUser({
              id: parsed.athlete.id,
              username: parsed.athlete.username || '',
              firstname: parsed.athlete.firstname || '',
              lastname: parsed.athlete.lastname || '',
              profile: profileUrl,
            })
          }
        }
      } catch (error) {
        console.warn('Impossible de charger les données utilisateur:', error)
      }
    }

    loadUser()

    // Écouter les changements dans localStorage (si l'utilisateur se connecte sur un autre onglet)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'vizion:strava_token') {
        loadUser()
      }
    }

    window.addEventListener('storage', handleStorageChange)
    return () => window.removeEventListener('storage', handleStorageChange)
  }, [])

  const handleStravaConnect = async () => {
    try {
      await redirectToStravaAuth()
    } catch (error) {
      console.error('Erreur lors de la connexion Strava:', error)
      alert(error instanceof Error ? error.message : 'Erreur lors de la connexion à Strava. Vérifiez la configuration.')
    }
  }

  const handleLogout = () => {
    localStorage.removeItem('vizion:strava_token')
    localStorage.removeItem('vizion:strava-metrics')
    setUser(null)
    // Optionnel : recharger la page pour mettre à jour l'état
    window.location.reload()
  }

  return (
    <header className="saison-topbar">
      <div className="saison-topbar__logo" role="button" tabIndex={0} onClick={() => onNavigate?.('saison')} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onNavigate?.('saison') }}>
        <img src={logoVision} alt="VZION" />
      </div>

      {/* Header race masqué pour le moment */}
      <div className="saison-topbar__race" style={{ display: 'none' }}>
        {/* Contenu masqué */}
      </div>

      {user ? (
        <div className="saison-topbar__user">
          {user.profile && (
            <img
              src={user.profile}
              alt={`${user.firstname} ${user.lastname}`}
              className="saison-topbar__user-avatar"
              onError={(e) => {
                // Si l'image ne charge pas, masquer l'avatar
                e.currentTarget.style.display = 'none'
              }}
            />
          )}
          <div className="saison-topbar__user-info">
            <span className="saison-topbar__user-name">
              {user.firstname} {user.lastname}
            </span>
          </div>
          <button
            className="saison-topbar__user-logout"
            type="button"
            onClick={handleLogout}
            title="Se déconnecter"
            aria-label="Se déconnecter"
          >
            ×
          </button>
        </div>
      ) : (
        <div className="saison-topbar__actions">
          <button
            className="btn btn--ghost"
            type="button"
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              const nativeEvent = e.nativeEvent
              if (nativeEvent.stopImmediatePropagation) {
                nativeEvent.stopImmediatePropagation()
              }
              console.log('[HeaderTopBar] Bouton Se connecter cliqué')
              console.log('[HeaderTopBar] État avant:', { isLoginModalOpen, loginModalMode })
              setLoginModalMode('login')
              setIsLoginModalOpen(true)
              console.log('[HeaderTopBar] État après setState')
            }}
          >
            Se connecter
          </button>
          <button
            className="btn btn--primary"
            type="button"
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              const nativeEvent = e.nativeEvent
              if (nativeEvent.stopImmediatePropagation) {
                nativeEvent.stopImmediatePropagation()
              }
              console.log('[HeaderTopBar] Bouton Créer un compte cliqué')
              console.log('[HeaderTopBar] État avant:', { isLoginModalOpen, loginModalMode })
              setLoginModalMode('signup')
              setIsLoginModalOpen(true)
              console.log('[HeaderTopBar] État après setState')
            }}
          >
            Créer un compte
          </button>
        </div>
      )}

      <LoginModal
        isOpen={isLoginModalOpen}
        initialMode={loginModalMode}
        onClose={() => setIsLoginModalOpen(false)}
        onLogin={async (email, password) => {
          // TODO: Implémenter la connexion avec Supabase
          console.log('Login:', email, password)
          alert('Fonctionnalité de connexion à implémenter')
        }}
        onSignup={async (email, password) => {
          // TODO: Implémenter l'inscription avec Supabase
          console.log('Signup:', email, password)
          alert('Fonctionnalité d\'inscription à implémenter')
        }}
        onStravaConnect={handleStravaConnect}
      />
    </header>
  )
}
