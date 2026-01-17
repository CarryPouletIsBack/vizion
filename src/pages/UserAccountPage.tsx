import { useEffect, useState } from 'react'
import './UserAccountPage.css'
import HeaderTopBar from '../components/HeaderTopBar'
import SideNav from '../components/SideNav'
import { redirectToStravaAuth } from '../lib/stravaAuth'
import { getCurrentUser, signOut } from '../lib/auth'

type UserAccountPageProps = {
  onNavigate?: (view: 'saison' | 'events' | 'courses' | 'course' | 'account') => void
}

type AppUser = {
  id: string
  email: string
  firstname?: string
  lastname?: string
  profile?: string
}

export default function UserAccountPage({ onNavigate }: UserAccountPageProps) {
  const [user, setUser] = useState<AppUser | null>(null)
  const [isStravaConnected, setIsStravaConnected] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    // Charger l'utilisateur Supabase
    const loadUser = async () => {
      try {
        const supabaseUser = await getCurrentUser()
        if (supabaseUser) {
          // Charger les données Strava si disponibles
          const tokenData = localStorage.getItem('vizion:strava_token')
          let stravaData = null
          if (tokenData) {
            try {
              stravaData = JSON.parse(tokenData)
              setIsStravaConnected(true)
            } catch (e) {
              // Ignorer les erreurs de parsing
            }
          }

          const profileUrl = stravaData?.athlete?.profile || stravaData?.athlete?.profile_medium || stravaData?.athlete?.profile_large

          setUser({
            id: supabaseUser.id,
            email: supabaseUser.email || '',
            firstname: stravaData?.athlete?.firstname || supabaseUser.user_metadata?.firstname,
            lastname: stravaData?.athlete?.lastname || supabaseUser.user_metadata?.lastname,
            profile: profileUrl,
          })
        } else {
          // Rediriger vers la page d'accueil si non connecté
          onNavigate?.('saison')
        }
      } catch (error) {
        console.warn('Impossible de charger l\'utilisateur:', error)
        onNavigate?.('saison')
      }
    }

    loadUser()

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'vizion:strava_token') {
        loadUser()
      }
    }

    window.addEventListener('storage', handleStorageChange)
    return () => window.removeEventListener('storage', handleStorageChange)
  }, [onNavigate])

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
      setIsStravaConnected(false)
      // Recharger les données utilisateur sans Strava
      if (user) {
        setUser({
          ...user,
          firstname: undefined,
          lastname: undefined,
          profile: undefined,
        })
      }
    }
  }

  const handleLogout = async () => {
    try {
      await signOut()
      localStorage.removeItem('vizion:strava_token')
      localStorage.removeItem('vizion:strava-metrics')
      setUser(null)
      window.location.reload()
    } catch (error) {
      console.error('Erreur lors de la déconnexion:', error)
      alert('Erreur lors de la déconnexion')
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
                      {user.email && (
                        <p className="user-account-profile__username">{user.email}</p>
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
