import { useEffect, useState } from 'react'
import './UserAccountPage.css'
import HeaderTopBar from '../components/HeaderTopBar'
import SideNav from '../components/SideNav'
import { redirectToStravaAuth } from '../lib/stravaAuth'

type UserAccountPageProps = {
  onNavigate?: (view: 'saison' | 'events' | 'courses' | 'course' | 'account') => void
}

type StravaUser = {
  id: number
  username: string
  firstname: string
  lastname: string
  profile?: string
  city?: string
  country?: string
  created_at?: string
}

export default function UserAccountPage({ onNavigate }: UserAccountPageProps) {
  const [user, setUser] = useState<StravaUser | null>(null)
  const [isStravaConnected, setIsStravaConnected] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    // Charger les données utilisateur depuis localStorage
    const loadUser = () => {
      try {
        const tokenData = localStorage.getItem('vizion:strava_token')
        if (tokenData) {
          const parsed = JSON.parse(tokenData)
          if (parsed.athlete) {
            const profileUrl = parsed.athlete.profile || parsed.athlete.profile_medium || parsed.athlete.profile_large
            setUser({
              id: parsed.athlete.id,
              username: parsed.athlete.username || '',
              firstname: parsed.athlete.firstname || '',
              lastname: parsed.athlete.lastname || '',
              profile: profileUrl,
              city: parsed.athlete.city,
              country: parsed.athlete.country,
              created_at: parsed.athlete.created_at,
            })
            setIsStravaConnected(true)
          }
        }
      } catch (error) {
        console.warn('Impossible de charger les données utilisateur:', error)
      }
    }

    loadUser()

    // Écouter les changements dans localStorage
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'vizion:strava_token') {
        loadUser()
      }
    }

    window.addEventListener('storage', handleStorageChange)
    return () => window.removeEventListener('storage', handleStorageChange)
  }, [])

  const handleStravaConnect = async () => {
    setIsLoading(true)
    try {
      await redirectToStravaAuth()
    } catch (error) {
      console.error('Erreur lors de la connexion Strava:', error)
      alert(error instanceof Error ? error.message : 'Erreur lors de la connexion à Strava')
      setIsLoading(false)
    }
  }

  const handleStravaDisconnect = () => {
    if (window.confirm('Êtes-vous sûr de vouloir déconnecter votre compte Strava ?')) {
      localStorage.removeItem('vizion:strava_token')
      localStorage.removeItem('vizion:strava-metrics')
      setUser(null)
      setIsStravaConnected(false)
      window.location.reload()
    }
  }

  return (
    <div className="user-account-page">
      <HeaderTopBar onNavigate={onNavigate} />

      <div className="user-account-body">
        <aside className="user-account-side">
          <SideNav activeItem="account" onNavigate={onNavigate} />
        </aside>

        <main className="user-account-main">
          <section className="user-account-header">
            <h1 className="user-account-title">Mon compte</h1>
            <p className="user-account-subtitle">Gérez vos informations et vos connexions</p>
          </section>

          <section className="user-account-content">
            {/* Profil utilisateur */}
            <div className="user-account-card">
              <div className="user-account-card__header">
                <h2 className="user-account-card__title">Profil</h2>
              </div>
              <div className="user-account-card__body">
                {user ? (
                  <div className="user-account-profile">
                    {user.profile && (
                      <div className="user-account-profile__avatar">
                        <img
                          src={user.profile}
                          alt={`${user.firstname} ${user.lastname}`}
                          onError={(e) => {
                            e.currentTarget.style.display = 'none'
                          }}
                        />
                      </div>
                    )}
                    <div className="user-account-profile__info">
                      <h3 className="user-account-profile__name">
                        {user.firstname} {user.lastname}
                      </h3>
                      {user.username && (
                        <p className="user-account-profile__username">@{user.username}</p>
                      )}
                      {(user.city || user.country) && (
                        <p className="user-account-profile__location">
                          {[user.city, user.country].filter(Boolean).join(', ')}
                        </p>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="user-account-empty">
                    <p className="user-account-empty__text">Aucun profil disponible</p>
                    <p className="user-account-empty__subtext">Connectez-vous avec Strava pour afficher votre profil</p>
                  </div>
                )}
              </div>
            </div>

            {/* Connexion Strava */}
            <div className="user-account-card">
              <div className="user-account-card__header">
                <h2 className="user-account-card__title">Connexions</h2>
              </div>
              <div className="user-account-card__body">
                <div className="user-account-connection">
                  <div className="user-account-connection__info">
                    <div className="user-account-connection__icon">
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M15.387 17.944l-2.089-4.116h-3.065L15.387 24l5.15-10.172h-3.066m-7.008-5.599l2.836 5.599h4.172L10.463 0l-7.01 13.828h4.169" />
                      </svg>
                    </div>
                    <div className="user-account-connection__details">
                      <h3 className="user-account-connection__name">Strava</h3>
                      <p className="user-account-connection__status">
                        {isStravaConnected ? (
                          <span className="user-account-connection__status--connected">Connecté</span>
                        ) : (
                          <span className="user-account-connection__status--disconnected">Non connecté</span>
                        )}
                      </p>
                    </div>
                  </div>
                  {isStravaConnected ? (
                    <button
                      type="button"
                      className="user-account-connection__button user-account-connection__button--disconnect"
                      onClick={handleStravaDisconnect}
                    >
                      Déconnecter
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="user-account-connection__button user-account-connection__button--connect"
                      onClick={handleStravaConnect}
                      disabled={isLoading}
                    >
                      {isLoading ? 'Connexion...' : 'Se connecter'}
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Statistiques */}
            {isStravaConnected && (
              <div className="user-account-card">
                <div className="user-account-card__header">
                  <h2 className="user-account-card__title">Statistiques</h2>
                </div>
                <div className="user-account-card__body">
                  <div className="user-account-stats">
                    <div className="user-account-stats__item">
                      <span className="user-account-stats__label">Activités synchronisées</span>
                      <span className="user-account-stats__value">-</span>
                    </div>
                    <div className="user-account-stats__item">
                      <span className="user-account-stats__label">Distance totale</span>
                      <span className="user-account-stats__value">-</span>
                    </div>
                    <div className="user-account-stats__item">
                      <span className="user-account-stats__label">Dénivelé total</span>
                      <span className="user-account-stats__value">-</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </section>
        </main>
      </div>
    </div>
  )
}
