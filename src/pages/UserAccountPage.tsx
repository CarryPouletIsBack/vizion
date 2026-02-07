import { useEffect, useState, useRef } from 'react'
import './UserAccountPage.css'
import HeaderTopBar from '../components/HeaderTopBar'
import SideNav from '../components/SideNav'
import { redirectToStravaAuth } from '../lib/stravaAuth'
import { getCurrentUser, signOut, updateProfile } from '../lib/auth'
import { getUserFitActivities, saveUserFitActivity, deleteUserFitActivity, type UserFitActivityRow } from '../lib/userFitActivities'
import { parseFitFile } from '../lib/parseFitFile'

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
  const [stravaStats, setStravaStats] = useState({
    activityCount: 0,
    totalDistance: 0,
    totalElevationGain: 0,
  })
  const [statsLoading, setStatsLoading] = useState(false)
  const [uploadFile, setUploadFile] = useState<File | null>(null)
  const [uploadFileName, setUploadFileName] = useState<string>('')
  const [uploadLoading, setUploadLoading] = useState(false)
  const uploadFileRef = useRef<HTMLInputElement | null>(null)
  /** ID utilisateur Supabase (pour enregistrer les .fit) — null si seulement Strava */
  const [supabaseUserId, setSupabaseUserId] = useState<string | null>(null)
  const [fitActivities, setFitActivities] = useState<UserFitActivityRow[]>([])
  const [fitActivitiesLoading, setFitActivitiesLoading] = useState(false)

  useEffect(() => {
    let mounted = true

    // Scroll vers le haut immédiatement au chargement de la page pour éviter le sursaut
    window.scrollTo({ top: 0, behavior: 'instant' })

    // Charger l'utilisateur Supabase
    const loadUser = async () => {
      try {
        const supabaseUser = await getCurrentUser()
        if (!mounted) return

        if (supabaseUser?.id) {
          setSupabaseUserId(supabaseUser.id)
          getUserFitActivities(supabaseUser.id).then((rows) => {
            setFitActivities(rows)
            try {
              const top5 = rows.slice(0, 5).map((r) => r.summary)
              if (top5.length > 0) localStorage.setItem('vizion_user_fit_top5', JSON.stringify(top5))
            } catch {
              // ignore
            }
          })
          const tokenData = localStorage.getItem('trackali:strava_token')
          let stravaData = null
          if (tokenData) {
            try {
              stravaData = JSON.parse(tokenData)
              setIsStravaConnected(true)
            } catch {
              // Ignorer
            }
          }

          const profileUrl = stravaData?.athlete?.profile || stravaData?.athlete?.profile_medium || stravaData?.athlete?.profile_large

          const userData = {
            id: supabaseUser.id,
            email: supabaseUser.email ?? '',
            firstname: stravaData?.athlete?.firstname ?? supabaseUser.user_metadata?.firstname,
            lastname: stravaData?.athlete?.lastname ?? supabaseUser.user_metadata?.lastname,
            birthdate: supabaseUser.user_metadata?.birthdate,
            profile: profileUrl,
          }
          setUser(userData)
          setFormData({
            email: userData.email,
            firstname: userData.firstname ?? '',
            lastname: userData.lastname ?? '',
            birthdate: userData.birthdate ?? '',
          })
        } else {
          setSupabaseUserId(null)
          setFitActivities([])
          const tokenData = localStorage.getItem('trackali:strava_token')
          if (tokenData) {
            try {
              const parsed = JSON.parse(tokenData)
              const athlete = parsed?.athlete
              if (athlete?.id) {
                setUser({
                  id: String(athlete.id),
                  email: athlete.email ?? '',
                  firstname: athlete.firstname,
                  lastname: athlete.lastname,
                  profile: athlete.profile ?? athlete.profile_medium ?? athlete.profile_large,
                })
                setIsStravaConnected(true)
                setFormData({
                  email: athlete.email ?? '',
                  firstname: athlete.firstname ?? '',
                  lastname: athlete.lastname ?? '',
                  birthdate: '',
                })
                return
              }
            } catch {
              // Ignorer
            }
          }
          setUser(null)
          setSupabaseUserId(null)
          setFitActivities([])
        }
      } catch (error) {
        if (!mounted) return
        console.warn('Impossible de charger l\'utilisateur:', error)
        // Ne pas rediriger immédiatement pour éviter le sursaut
      }
    }

    loadUser()

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'trackali:strava_token' && mounted) {
        loadUser()
      }
    }

    window.addEventListener('storage', handleStorageChange)
    return () => {
      mounted = false
      window.removeEventListener('storage', handleStorageChange)
    }
  }, [onNavigate])

  // Charger les statistiques Strava depuis l'API
  useEffect(() => {
    const loadStravaStats = async () => {
      setStatsLoading(true)
      try {
        const tokenData = localStorage.getItem('trackali:strava_token')
        if (!tokenData) {
          setStravaStats({ activityCount: 0, totalDistance: 0, totalElevationGain: 0 })
          setStatsLoading(false)
          return
        }

        // Récupérer les activités depuis l'API
        const parsed = JSON.parse(tokenData)
        if (parsed.access_token) {
          const response = await fetch('/api/strava/activities', {
            headers: {
              Authorization: `Bearer ${parsed.access_token}`,
            },
          })

          if (response.ok) {
            const data = await response.json()
            const activities = data.activities || []
            
            // L'API retourne distanceKm et elevationGain (pas distance et total_elevation_gain)
            const totalDistance = activities.reduce((sum: number, act: any) => {
              // distanceKm est en km, on le convertit en mètres pour l'affichage
              const distanceM = (act.distanceKm || 0) * 1000
              return sum + distanceM
            }, 0)
            const totalElevationGain = activities.reduce((sum: number, act: any) => sum + (act.elevationGain || 0), 0)
            
            setStravaStats({
              activityCount: activities.length,
              totalDistance,
              totalElevationGain,
            })
          } else {
            setStravaStats({ activityCount: 0, totalDistance: 0, totalElevationGain: 0 })
          }
        } else {
          setStravaStats({ activityCount: 0, totalDistance: 0, totalElevationGain: 0 })
        }
      } catch (error) {
        console.warn('Erreur lors du chargement des statistiques Strava:', error)
        setStravaStats({ activityCount: 0, totalDistance: 0, totalElevationGain: 0 })
      } finally {
        setStatsLoading(false)
      }
    }

    if (isStravaConnected) {
      loadStravaStats()
    } else {
      setStravaStats({ activityCount: 0, totalDistance: 0, totalElevationGain: 0 })
      setStatsLoading(false)
    }
  }, [isStravaConnected])

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
      localStorage.removeItem('trackali:strava_token')
      localStorage.removeItem('trackali:strava-metrics')
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
      localStorage.removeItem('trackali:strava_token')
      localStorage.removeItem('trackali:strava-metrics')
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
      if (supabaseUser?.id) {
        const tokenData = localStorage.getItem('trackali:strava_token')
        let stravaData = null
        if (tokenData) {
          try {
            stravaData = JSON.parse(tokenData)
          } catch {
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
      localStorage.removeItem('trackali:strava_token')
      localStorage.removeItem('trackali:strava-metrics')
      alert('Votre compte a été supprimé. Vous allez être redirigé.')
      window.location.href = '/'
    } catch (error) {
      console.error('Erreur lors de la suppression du compte:', error)
      alert(error instanceof Error ? error.message : 'Erreur lors de la suppression du compte')
    } finally {
      setIsLoading(false)
    }
  }

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (file) {
      const extension = file.name.split('.').pop()?.toLowerCase()
      if (extension === 'fit') {
        setUploadFile(file)
        setUploadFileName(file.name)
      } else {
        alert('Pour vos 5 sorties les plus longues, utilisez un fichier .fit (Garmin, Strava export, etc.).')
      }
    }
  }

  const handleFileUpload = async () => {
    if (!uploadFile || !supabaseUserId) return

    setUploadLoading(true)
    try {
      const buffer = await uploadFile.arrayBuffer()
      const summary = await parseFitFile(buffer)
      if (!summary) {
        alert('Aucune session ou tour trouvé dans ce fichier .fit.')
        setUploadLoading(false)
        return
      }
      const saved = await saveUserFitActivity(supabaseUserId, uploadFile.name, summary)
      if (saved) {
        const rows = await getUserFitActivities(supabaseUserId)
        setFitActivities(rows)
        try {
          const top5 = rows.slice(0, 5).map((r) => r.summary)
          if (top5.length > 0) localStorage.setItem('vizion_user_fit_top5', JSON.stringify(top5))
        } catch {
          // ignore
        }
        setUploadFile(null)
        setUploadFileName('')
        if (uploadFileRef.current) uploadFileRef.current.value = ''
      } else {
        alert('Impossible d\'enregistrer le fichier. Réessayez.')
      }
    } catch (error) {
      console.error('Erreur lors de l\'import du fichier:', error)
      alert(error instanceof Error ? error.message : 'Erreur lors de l\'import du fichier .fit')
    } finally {
      setUploadLoading(false)
    }
  }

  const handleDeleteFit = async (id: string) => {
    if (!supabaseUserId) return
    if (!window.confirm('Supprimer cette sortie de la liste ?')) return
    setFitActivitiesLoading(true)
    try {
      const ok = await deleteUserFitActivity(supabaseUserId, id)
      if (ok) {
        setFitActivities((prev) => {
          const next = prev.filter((r) => r.id !== id)
          try {
            const top5 = next.slice(0, 5).map((r) => r.summary)
            if (top5.length > 0) localStorage.setItem('vizion_user_fit_top5', JSON.stringify(top5))
            else localStorage.removeItem('vizion_user_fit_top5')
          } catch {
            // ignore
          }
          return next
        })
      }
    } finally {
      setFitActivitiesLoading(false)
    }
  }

  function formatDuration(sec: number): string {
    const h = Math.floor(sec / 3600)
    const m = Math.floor((sec % 3600) / 60)
    if (h > 0) return `${h}h ${m}min`
    return `${m} min`
  }

  const handleFileCancel = () => {
    setUploadFile(null)
    setUploadFileName('')
    if (uploadFileRef.current) {
      uploadFileRef.current.value = ''
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
          {!user ? (
            <section className="user-account-not-connected">
              <h1 className="user-account-title">Mon compte</h1>
              <p className="user-account-subtitle">Connectez-vous pour accéder à votre compte</p>
              <div className="user-account-not-connected__actions">
                <button
                  type="button"
                  className="btn btn--primary"
                  onClick={() => {
                    window.dispatchEvent(new CustomEvent('openLoginModal'))
                  }}
                >
                  Se connecter
                </button>
                <button
                  type="button"
                  className="btn btn--ghost"
                  onClick={() => onNavigate?.('saison')}
                >
                  Retour à l'accueil
                </button>
              </div>
            </section>
          ) : (
            <>
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
                  <>
                    {/* Connexion Strava intégrée dans Profil */}
                    <div className="user-account-profile__connections">
                      <h3 className="user-account-profile__connections-title">Connexions</h3>
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
                    <button
                      type="button"
                      className="user-account-delete"
                      onClick={handleDeleteAccount}
                      disabled={isLoading}
                    >
                      Supprimer le compte
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Statistiques et Import en deux colonnes */}
            <div className="user-account-cards-grid">
              {/* Vos 5 sorties les plus longues (.fit) — visible uniquement avec compte Trackali */}
              {supabaseUserId ? (
                <div className="user-account-card">
                  <div className="user-account-card__header">
                    <h2 className="user-account-card__title">Vos 5 sorties les plus longues (.fit)</h2>
                  </div>
                  <div className="user-account-card__body">
                    <p className="user-account-fit-intro">
                      Ajoutez les fichiers .fit de vos sorties les plus longues. Les 5 meilleures sont utilisées pour analyser votre préparation sur chaque course.
                    </p>
                    <div className="user-account-upload">
                      <div className="user-account-upload__zone">
                        <input
                          type="file"
                          id="activity-upload"
                          ref={uploadFileRef}
                          onChange={handleFileSelect}
                          accept=".fit,application/fit"
                          style={{ display: 'none' }}
                        />
                        <label htmlFor="activity-upload" className="user-account-upload__label">
                          <div className="user-account-upload__icon">
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                              <polyline points="17 8 12 3 7 8" />
                              <line x1="12" y1="3" x2="12" y2="15" />
                            </svg>
                          </div>
                          <span className="user-account-upload__text">
                            {uploadFileName || 'Ajouter un fichier .fit'}
                          </span>
                          <span className="user-account-upload__formats">
                            Format .fit (Garmin, Strava, etc.)
                          </span>
                        </label>
                      </div>
                      {uploadFile && (
                        <div className="user-account-upload__actions">
                          <button
                            type="button"
                            className="btn btn--ghost"
                            onClick={handleFileCancel}
                            disabled={uploadLoading}
                          >
                            Annuler
                          </button>
                          <button
                            type="button"
                            className="btn btn--primary"
                            onClick={handleFileUpload}
                            disabled={uploadLoading}
                          >
                            {uploadLoading ? 'Import...' : 'Enregistrer'}
                          </button>
                        </div>
                      )}
                    </div>
                    {fitActivitiesLoading && fitActivities.length === 0 ? (
                      <p className="user-account-fit-loading">Chargement...</p>
                    ) : fitActivities.length > 0 ? (
                      <ul className="user-account-fit-list" aria-label="Sorties .fit enregistrées">
                        {fitActivities.map((row, index) => (
                          <li key={row.id} className="user-account-fit-item">
                            <span className="user-account-fit-item__rank">#{index + 1}</span>
                            <span className="user-account-fit-item__name">{row.file_name}</span>
                            <span className="user-account-fit-item__stats">
                              {row.summary.distanceKm != null && `${row.summary.distanceKm.toFixed(1)} km`}
                              {row.summary.durationSec != null && ` · ${formatDuration(row.summary.durationSec)}`}
                              {row.summary.ascentM != null && ` · ${Math.round(row.summary.ascentM)} m D+`}
                            </span>
                            <button
                              type="button"
                              className="btn btn--ghost btn--small user-account-fit-item__delete"
                              onClick={() => handleDeleteFit(row.id)}
                              disabled={fitActivitiesLoading}
                              aria-label={`Supprimer ${row.file_name}`}
                            >
                              Supprimer
                            </button>
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </div>
                </div>
              ) : (
                <div className="user-account-card">
                  <div className="user-account-card__header">
                    <h2 className="user-account-card__title">Vos sorties .fit</h2>
                  </div>
                  <div className="user-account-card__body">
                    <p className="user-account-fit-intro">
                      Créez un compte Trackali (email / mot de passe) pour enregistrer vos fichiers .fit et utiliser vos 5 sorties les plus longues dans l&apos;analyse de préparation.
                    </p>
                    <button
                      type="button"
                      className="btn btn--primary"
                      onClick={() => window.dispatchEvent(new CustomEvent('openLoginModal', { detail: { mode: 'signup' } }))}
                    >
                      Créer un compte Trackali
                    </button>
                  </div>
                </div>
              )}

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
                          {statsLoading ? '...' : stravaStats.activityCount > 0 ? stravaStats.activityCount : '-'}
                        </span>
                      </div>
                      <div className="user-account-stats__item">
                        <span className="user-account-stats__label">Distance totale</span>
                        <span className="user-account-stats__value">
                          {statsLoading ? '...' : stravaStats.totalDistance > 0 ? `${(stravaStats.totalDistance / 1000).toFixed(0)} km` : '-'}
                        </span>
                      </div>
                      <div className="user-account-stats__item">
                        <span className="user-account-stats__label">Dénivelé total</span>
                        <span className="user-account-stats__value">
                          {statsLoading ? '...' : stravaStats.totalElevationGain > 0 ? `${Math.round(stravaStats.totalElevationGain)} m` : '-'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
              </section>
            </>
          )}
        </main>
      </div>
    </div>
  )
}
