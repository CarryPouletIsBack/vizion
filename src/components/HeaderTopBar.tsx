import { useEffect, useState } from 'react'
import { FiSun, FiCloud, FiCloudRain, FiMoon, FiUser } from 'react-icons/fi'

import './HeaderTopBar.css'

import logoVision from '../assets/c5c94aad0b681f3e62439f66f02703ba7c8b5826.svg'
import { redirectToStravaAuth } from '../lib/stravaAuth'
import { getWeather, getCityFromCoords, weatherIconType, type WeatherIconType } from '../lib/xweather'
import { signIn, signUp, onAuthStateChange, getCurrentUser } from '../lib/auth'
import LoginModal from './LoginModal'

type HeaderTopBarProps = {
  onNavigate?: (view: 'saison' | 'events' | 'courses' | 'course' | 'account') => void
}

type AppUser = {
  id: string
  email: string
  firstname?: string
  lastname?: string
  profile?: string // URL de la photo de profil (Strava)
}

type LocationWeather = {
  city: string
  tempC: number
  iconType: WeatherIconType
}

export default function HeaderTopBar({ onNavigate }: HeaderTopBarProps) {
  const [user, setUser] = useState<AppUser | null | 'loading'>('loading') // 'loading' pour éviter le flash
  const [avatarError, setAvatarError] = useState(false)
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false)
  const [loginModalMode, setLoginModalMode] = useState<'login' | 'signup' | 'forgot-password' | 'otp-expired'>('login')
  const [locationWeather, setLocationWeather] = useState<LocationWeather | null>(null)
  const [currentTime, setCurrentTime] = useState<string>(() => {
    const d = new Date()
    return `${d.getHours().toString().padStart(2, '0')}h${d.getMinutes().toString().padStart(2, '0')}`
  })

  // Détecter l'erreur otp_expired dans l'URL et ouvrir automatiquement la modale
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const hash = window.location.hash
      const searchParams = new URLSearchParams(window.location.search)
      
      // Vérifier dans le hash (#error_code=otp_expired) ou dans les query params
      if (hash.includes('error_code=otp_expired') || searchParams.get('error_code') === 'otp_expired') {
        setLoginModalMode('otp-expired')
        setIsLoginModalOpen(true)
        // Nettoyer l'URL
        const cleanUrl = window.location.href.split('#')[0].split('?')[0]
        window.history.replaceState({}, '', cleanUrl)
      }
    }
  }, [])

  // Réinitialiser l’erreur avatar quand l’utilisateur ou sa photo change
  useEffect(() => {
    setAvatarError(false)
  }, [user != null && user !== 'loading' ? user.id : null, user != null && user !== 'loading' ? user.profile : null])

  // Écouter l'événement personnalisé pour ouvrir la modale de connexion
  useEffect(() => {
    const handleOpenLoginModal = () => {
      setLoginModalMode('login')
      setIsLoginModalOpen(true)
    }
    window.addEventListener('openLoginModal', handleOpenLoginModal as EventListener)
    return () => {
      window.removeEventListener('openLoginModal', handleOpenLoginModal as EventListener)
    }
  }, [])

  // En local : données d'exemple pour vérifier l'affichage (ville + ° + icône)
  const isLocal = typeof window !== 'undefined' &&
    (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')

  const exampleWeather: LocationWeather = {
    city: 'Saint-Denis (exemple)',
    tempC: 24,
    iconType: 'sun',
  }

  // Mise à jour de l'heure affichée (toutes les minutes)
  useEffect(() => {
    const tick = () => {
      const d = new Date()
      setCurrentTime(`${d.getHours().toString().padStart(2, '0')}h${d.getMinutes().toString().padStart(2, '0')}`)
    }
    const id = setInterval(tick, 60 * 1000)
    return () => clearInterval(id)
  }, [])

  // Météo et ville de l'utilisateur (géoloc + cache 4h) ; en local on affiche l'exemple puis éventuellement les vraies données
  useEffect(() => {
    if (isLocal) {
      setLocationWeather(exampleWeather)
    }

    if (!navigator?.geolocation?.getCurrentPosition) return
    let cancelled = false
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        if (cancelled) return
        const { latitude, longitude } = pos.coords
        const [weather, city] = await Promise.all([
          getWeather(latitude, longitude),
          getCityFromCoords(latitude, longitude),
        ])
        if (cancelled || !weather) return
        const iconType = weatherIconType(weather.icon)
        setLocationWeather({
          city: city ?? 'Position actuelle',
          tempC: weather.tempC,
          iconType,
        })
      },
      () => {
        if (isLocal) setLocationWeather(exampleWeather)
      },
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 4 * 60 * 60 * 1000 }
    )
    return () => { cancelled = true }
  }, [isLocal])

  // Écouter l'événement personnalisé pour ouvrir la modale de connexion
  useEffect(() => {
    const handleOpenLoginModal = () => {
      setLoginModalMode('login')
      setIsLoginModalOpen(true)
    }
    window.addEventListener('openLoginModal', handleOpenLoginModal as EventListener)
    return () => {
      window.removeEventListener('openLoginModal', handleOpenLoginModal as EventListener)
    }
  }, [])

  useEffect(() => {
    let mounted = true

    // Charger l'utilisateur Supabase
    const loadSupabaseUser = async () => {
      try {
        const supabaseUser = await getCurrentUser()
        if (!mounted) return

        if (supabaseUser?.id) {
          const tokenData = localStorage.getItem('vizion:strava_token')
          let stravaData = null
          if (tokenData) {
            try {
              stravaData = JSON.parse(tokenData)
            } catch {
              // Ignorer les erreurs de parsing
            }
          }

          if (mounted) {
            setUser({
              id: supabaseUser.id,
              email: supabaseUser.email ?? '',
              firstname: stravaData?.athlete?.firstname ?? supabaseUser.user_metadata?.firstname,
              lastname: stravaData?.athlete?.lastname ?? supabaseUser.user_metadata?.lastname,
              profile: stravaData?.athlete?.profile ?? stravaData?.athlete?.profile_medium ?? stravaData?.athlete?.profile_large,
            })
          }
        } else {
          // Supabase indisponible ou non connecté : afficher "connecté" si token Strava présent (après callback OAuth)
          const tokenData = localStorage.getItem('vizion:strava_token')
          if (mounted && tokenData) {
            try {
              const parsed = JSON.parse(tokenData)
              const athlete = parsed?.athlete
              if (athlete?.id) {
                setUser({
                  id: String(athlete.id),
                  email: parsed.athlete?.email ?? '',
                  firstname: athlete.firstname,
                  lastname: athlete.lastname,
                  profile: athlete.profile ?? athlete.profile_medium ?? athlete.profile_large,
                })
                return
              }
            } catch {
              // Ignorer
            }
          }
          if (mounted) setUser(null)
        }
      } catch (error) {
        if (!mounted) return
        console.warn('Impossible de charger l\'utilisateur:', error)
        if (mounted) setUser(null)
      }
    }

    loadSupabaseUser()

    // Écouter les changements d'authentification Supabase
    const { data: { subscription } } = onAuthStateChange((supabaseUser) => {
      if (!mounted) return

      if (supabaseUser?.id) {
        const tokenData = localStorage.getItem('vizion:strava_token')
        let stravaData = null
        if (tokenData) {
          try {
            stravaData = JSON.parse(tokenData)
          } catch {
            // Ignorer
          }
        }

        setUser({
          id: supabaseUser.id,
          email: supabaseUser.email ?? '',
          firstname: stravaData?.athlete?.firstname ?? supabaseUser.user_metadata?.firstname,
          lastname: stravaData?.athlete?.lastname ?? supabaseUser.user_metadata?.lastname,
          profile: stravaData?.athlete?.profile ?? stravaData?.athlete?.profile_medium ?? stravaData?.athlete?.profile_large,
        })
      } else {
        const tokenData = localStorage.getItem('vizion:strava_token')
        if (tokenData) {
          try {
            const parsed = JSON.parse(tokenData)
            const athlete = parsed?.athlete
            if (athlete?.id) {
              setUser({
                id: String(athlete.id),
                email: parsed.athlete?.email ?? '',
                firstname: athlete.firstname,
                lastname: athlete.lastname,
                profile: athlete.profile ?? athlete.profile_medium ?? athlete.profile_large,
              })
              return
            }
          } catch {
            // Ignorer
          }
        }
        setUser(null)
      }
    })

    // Écouter les changements dans localStorage pour Strava
    const handleStorageChange = (e: StorageEvent) => {
      if (!mounted) return
      if (e.key === 'vizion:strava_token' && user && user !== 'loading') {
        try {
          const tokenData = e.newValue
          if (tokenData) {
            const parsed = JSON.parse(tokenData)
            if (parsed.athlete) {
              setUser((prevUser) => {
                if (!prevUser || prevUser === 'loading') return prevUser
                return {
                  ...prevUser,
                  firstname: parsed.athlete.firstname || prevUser.firstname,
                  lastname: parsed.athlete.lastname || prevUser.lastname,
                  profile: parsed.athlete.profile || parsed.athlete.profile_medium || parsed.athlete.profile_large || prevUser.profile,
                }
              })
            }
          }
        } catch (error) {
          // Ignorer les erreurs
        }
      }
    }

    window.addEventListener('storage', handleStorageChange)
    return () => {
      mounted = false
      subscription.unsubscribe()
      window.removeEventListener('storage', handleStorageChange)
    }
  }, []) // Retirer 'user' des dépendances pour éviter les boucles infinies

  const handleStravaConnect = async () => {
    try {
      await redirectToStravaAuth()
    } catch (error) {
      console.error('Erreur lors de la connexion Strava:', error)
      alert(error instanceof Error ? error.message : 'Erreur lors de la connexion à Strava. Vérifiez la configuration.')
    }
  }

  return (
    <header className="saison-topbar">
      <div className="saison-topbar__logo" role="button" tabIndex={0} onClick={() => onNavigate?.('saison')} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onNavigate?.('saison') }}>
        <img src={logoVision} alt="Trackali" />
      </div>

      {/* Header race masqué pour le moment */}
      <div className="saison-topbar__race" style={{ display: 'none' }}>
        {/* Contenu masqué */}
      </div>

      {/* Lieu, météo, heure + compte/connexion : affichés pour tous, groupés à droite */}
      <div className="saison-topbar__actions">
        {locationWeather && (
          <div className="saison-topbar__weather" aria-label={`Météo : ${locationWeather.city}, ${Math.round(locationWeather.tempC)}°C, ${currentTime}`}>
            <span className="saison-topbar__weather-icon">
              {locationWeather.iconType === 'sun' && <FiSun />}
              {locationWeather.iconType === 'cloud' && <FiCloud />}
              {locationWeather.iconType === 'rain' && <FiCloudRain />}
              {locationWeather.iconType === 'moon' && <FiMoon />}
            </span>
            <span className="saison-topbar__weather-text">
              {locationWeather.city} · {Math.round(locationWeather.tempC)}° · {currentTime}
            </span>
          </div>
        )}
        {user === 'loading' ? null : user ? (
        <button
          className="saison-topbar__user-trigger"
          type="button"
          onClick={() => onNavigate?.('account')}
          title="Mon compte"
          aria-label="Mon compte"
        >
          {user.profile && !avatarError ? (
            <img
              src={user.profile}
              alt=""
              className="saison-topbar__user-trigger-avatar"
              onError={() => setAvatarError(true)}
            />
          ) : (
            <FiUser />
          )}
        </button>
      ) : (
        <button
          className="saison-topbar__user-trigger"
          type="button"
          onClick={() => {
            setLoginModalMode('login')
            setIsLoginModalOpen(true)
          }}
          title="Se connecter ou créer un compte"
          aria-label="Se connecter ou créer un compte"
        >
          <FiUser />
        </button>
        )}
      </div>

      <LoginModal
        isOpen={isLoginModalOpen}
        initialMode={loginModalMode}
        onClose={() => setIsLoginModalOpen(false)}
        onLogin={async (email, password) => {
          try {
            await signIn(email, password)
            setIsLoginModalOpen(false)
            // L'utilisateur sera mis à jour via onAuthStateChange
          } catch (error) {
            throw error
          }
        }}
        onSignup={async (email, password) => {
          try {
            await signUp(email, password)
            setIsLoginModalOpen(false)
            alert('Compte créé avec succès ! Vérifiez votre email pour confirmer votre compte.')
            // L'utilisateur sera mis à jour via onAuthStateChange après confirmation email
          } catch (error) {
            throw error
          }
        }}
        onStravaConnect={handleStravaConnect}
      />
    </header>
  )
}
