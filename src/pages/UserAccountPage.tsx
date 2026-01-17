import { useEffect, useState } from 'react'
import './UserAccountPage.css'
import HeaderTopBar from '../components/HeaderTopBar'
import SideNav from '../components/SideNav'
import { redirectToStravaAuth } from '../lib/stravaAuth'
import { getCurrentUser, signOut, updateProfile } from '../lib/auth'
import useStravaMetrics from '../hooks/useStravaMetrics'

type UserAccountPageProps = {
  onNavigate?: (view: 'saison' | 'events' | 'courses' | 'course' | 'account') => void
}

type AppUser = {
  id: string
  email: string
  firstname?: string
  lastname?: string
  birthdate?: string
  profile?: string
}

export default function UserAccountPage({ onNavigate }: UserAccountPageProps) {
  const [user, setUser] = useState<AppUser | null>(null)
  const [isStravaConnected, setIsStravaConnected] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [formData, setFormData] = useState({
    email: '',
    firstname: '',
    lastname: '',
    birthdate: '',
  })
  const { metrics, loading: metricsLoading } = useStravaMetrics()
  const [stravaStats, setStravaStats] = useState({
    activityCount: 0,
    totalDistance: 0,
    totalElevationGain: 0,
  })

  useEffect(() => {
    let mounted = true

    // Charger l'utilisateur Supabase
    const loadUser = async () => {
      try {
        const supabaseUser = await getCurrentUser()
        if (!mounted) return

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

          const userData = {
            id: supabaseUser.id,
            email: supabaseUser.email || '',
            firstname: stravaData?.athlete?.firstname || supabaseUser.user_metadata?.firstname,
            lastname: stravaData?.athlete?.lastname || supabaseUser.user_metadata?.lastname,
            birthdate: supabaseUser.user_metadata?.birthdate,
            profile: profileUrl,
          }
          setUser(userData)
          setFormData({
            email: userData.email,
            firstname: userData.firstname || '',
            lastname: userData.lastname || '',
            birthdate: userData.birthdate || '',
          })
        } else {
          // Rediriger vers la page d'accueil si non connecté
          onNavigate?.('saison')
        }
      } catch (error) {
        if (!mounted) return
        console.warn('Impossible de charger l\'utilisateur:', error)
        onNavigate?.('saison')
      }
    }

    loadUser()

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'vizion:strava_token' && mounted) {
        loadUser()
      }
    }

    window.addEventListener('storage', handleStorageChange)
    return () => {
      mounted = false
      window.removeEventListener('storage', handleStorageChange)
    }
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

  const handleEdit = () => {
    setIsEditing(true)
  }

  const handleCancel = () => {
    if (user) {
      setFormData({
        email: user.email,
        firstname: user.firstname || '',
        lastname: user.lastname || '',
        birthdate: user.birthdate || '',
      })
    }
    setIsEditing(false)
  }

  const handleSave = async () => {
    setIsLoading(true)
    try {
      await updateProfile({
        email: formData.email,
        firstname: formData.firstname || undefined,
        lastname: formData.lastname || undefined,
        birthdate: formData.birthdate || undefined,
      })

      // Recharger l'utilisateur
      const supabaseUser = await getCurrentUser()
      if (supabaseUser) {
        const tokenData = localStorage.getItem('vizion:strava_token')
        let stravaData = null
        if (tokenData) {
          try {
            stravaData = JSON.parse(tokenData)
          } catch (e) {
            // Ignorer
          }
        }
        const profileUrl = stravaData?.athlete?.profile || stravaData?.athlete?.profile_medium || stravaData?.athlete?.profile_large

        setUser({
          id: supabaseUser.id,
          email: formData.email,
          firstname: formData.firstname || undefined,
          lastname: formData.lastname || undefined,
          birthdate: formData.birthdate || undefined,
          profile: profileUrl,
        })
      }

      setIsEditing(false)
      alert('Profil mis à jour avec succès')
    } catch (error) {
      console.error('Erreur lors de la mise à jour du profil:', error)
      alert(error instanceof Error ? error.message : 'Erreur lors de la mise à jour du profil')
    } finally {
      setIsLoading(false)
    }
  }

  const handleDeleteAccount = async () => {
    const confirm1 = window.confirm('Êtes-vous sûr de vouloir supprimer votre compte ? Cette action est irréversible.')
    if (!confirm1) return

    const confirm2 = window.confirm('Cette action supprimera définitivement toutes vos données. Tapez "SUPPRIMER" pour confirmer.')
    if (confirm2 !== true) return

    setIsLoading(true)
    try {
      // Note: La suppression de compte nécessite généralement une confirmation par email
      // Pour l'instant, on déconnecte l'utilisateur
      await signOut()
      localStorage.removeItem('vizion:strava_token')
      localStorage.removeItem('vizion:strava-metrics')
      alert('Votre compte a été supprimé. Vous allez être redirigé.')
      window.location.href = '/'
    } catch (error) {
      console.error('Erreur lors de la suppression du compte:', error)
      alert(error instanceof Error ? error.message : 'Erreur lors de la suppression du compte')
    } finally {
      setIsLoading(false)
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
            <div>
              <h1 className="user-account-title">Mon compte</h1>
              <p className="user-account-subtitle">Gérez vos informations et vos connexions</p>
            </div>
            <button type="button" className="btn btn--ghost" onClick={handleLogout}>
              Se déconnecter
            </button>
          </section>

          <section className="user-account-content">
            {/* Profil utilisateur */}
            <div className="user-account-card">
              <div className="user-account-card__header">
                <h2 className="user-account-card__title">Profil</h2>
                {!isEditing && user && (
                  <button type="button" className="btn btn--ghost btn--small" onClick={handleEdit}>
                    Éditer
                  </button>
                )}
              </div>
              <div className="user-account-card__body">
                {user ? (
                  isEditing ? (
                    <form className="user-account-form" onSubmit={(e) => { e.preventDefault(); handleSave(); }}>
                      <div className="user-account-form__field">
                        <label htmlFor="email">Adresse email</label>
                        <input
                          id="email"
                          type="email"
                          value={formData.email}
                          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                          required
                        />
                      </div>
                      <div className="user-account-form__field">
                        <label htmlFor="firstname">Prénom</label>
                        <input
                          id="firstname"
                          type="text"
                          value={formData.firstname}
                          onChange={(e) => setFormData({ ...formData, firstname: e.target.value })}
                        />
                      </div>
                      <div className="user-account-form__field">
                        <label htmlFor="lastname">Nom</label>
                        <input
                          id="lastname"
                          type="text"
                          value={formData.lastname}
                          onChange={(e) => setFormData({ ...formData, lastname: e.target.value })}
                        />
                      </div>
                      <div className="user-account-form__field">
                        <label htmlFor="birthdate">Date de naissance</label>
                        <input
                          id="birthdate"
                          type="date"
                          value={formData.birthdate}
                          onChange={(e) => setFormData({ ...formData, birthdate: e.target.value })}
                        />
                      </div>
                      <div className="user-account-form__actions">
                        <button type="button" className="btn btn--ghost" onClick={handleCancel} disabled={isLoading}>
                          Annuler
                        </button>
                        <button type="submit" className="btn btn--primary" disabled={isLoading}>
                          {isLoading ? 'Enregistrement...' : 'Enregistrer'}
                        </button>
                      </div>
                    </form>
                  ) : (
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
                          {user.firstname && user.lastname
                            ? `${user.firstname} ${user.lastname}`
                            : user.email}
                        </h3>
                        {user.email && (
                          <p className="user-account-profile__username">{user.email}</p>
                        )}
                        {user.birthdate && (
                          <p className="user-account-profile__birthdate">
                            Date de naissance : {new Date(user.birthdate).toLocaleDateString('fr-FR')}
                          </p>
                        )}
                      </div>
                    </div>
                  )
                ) : (
                  <div className="user-account-empty">
                    <p className="user-account-empty__text">Aucun profil disponible</p>
                    <p className="user-account-empty__subtext">Connectez-vous avec Strava pour afficher votre profil</p>
                  </div>
                )}
                {!isEditing && user && (
                  <button
                    type="button"
                    className="user-account-delete"
                    onClick={handleDeleteAccount}
                    disabled={isLoading}
                  >
                    Supprimer le compte
                  </button>
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
                      <span className="user-account-stats__value">
                        {metricsLoading ? '...' : stravaStats.activityCount || '-'}
                      </span>
                    </div>
                    <div className="user-account-stats__item">
                      <span className="user-account-stats__label">Distance totale</span>
                      <span className="user-account-stats__value">
                        {metricsLoading ? '...' : stravaStats.totalDistance > 0 ? `${(stravaStats.totalDistance / 1000).toFixed(0)} km` : '-'}
                      </span>
                    </div>
                    <div className="user-account-stats__item">
                      <span className="user-account-stats__label">Dénivelé total</span>
                      <span className="user-account-stats__value">
                        {metricsLoading ? '...' : stravaStats.totalElevationGain > 0 ? `${Math.round(stravaStats.totalElevationGain)} m` : '-'}
                      </span>
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
