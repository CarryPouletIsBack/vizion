import { useEffect, useState } from 'react'
import { HiX } from 'react-icons/hi'

import './HeaderTopBar.css'

import logoVision from '../assets/c5c94aad0b681f3e62439f66f02703ba7c8b5826.svg'
import { redirectToStravaAuth } from '../lib/stravaAuth'
import { signIn, signUp, signOut, onAuthStateChange, getCurrentUser } from '../lib/auth'
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

export default function HeaderTopBar({ onNavigate }: HeaderTopBarProps) {
  const [user, setUser] = useState<AppUser | null | 'loading'>('loading') // 'loading' pour éviter le flash
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false)
  const [loginModalMode, setLoginModalMode] = useState<'login' | 'signup' | 'forgot-password' | 'otp-expired'>('login')

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

  // Debug en production
  useEffect(() => {
    console.log('HeaderTopBar - isLoginModalOpen:', isLoginModalOpen, 'loginModalMode:', loginModalMode)
  }, [isLoginModalOpen, loginModalMode])

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

        if (supabaseUser) {
          // Charger les données Strava si disponibles
          const tokenData = localStorage.getItem('vizion:strava_token')
          let stravaData = null
          if (tokenData) {
            try {
              stravaData = JSON.parse(tokenData)
            } catch (e) {
              // Ignorer les erreurs de parsing
            }
          }

          if (mounted) {
            setUser({
              id: supabaseUser.id,
              email: supabaseUser.email || '',
              firstname: stravaData?.athlete?.firstname || supabaseUser.user_metadata?.firstname,
              lastname: stravaData?.athlete?.lastname || supabaseUser.user_metadata?.lastname,
              profile: stravaData?.athlete?.profile || stravaData?.athlete?.profile_medium || stravaData?.athlete?.profile_large,
            })
          }
        } else {
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
    const { data: { subscription } } = onAuthStateChange(async (supabaseUser) => {
      if (!mounted) return

      if (supabaseUser) {
        // Charger les données Strava si disponibles
        const tokenData = localStorage.getItem('vizion:strava_token')
        let stravaData = null
        if (tokenData) {
          try {
            stravaData = JSON.parse(tokenData)
          } catch (e) {
            // Ignorer les erreurs de parsing
          }
        }

        setUser({
          id: supabaseUser.id,
          email: supabaseUser.email || '',
          firstname: stravaData?.athlete?.firstname || supabaseUser.user_metadata?.firstname,
          lastname: stravaData?.athlete?.lastname || supabaseUser.user_metadata?.lastname,
          profile: stravaData?.athlete?.profile || stravaData?.athlete?.profile_medium || stravaData?.athlete?.profile_large,
        })
      } else {
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
    <header className="saison-topbar">
      <div className="saison-topbar__logo" role="button" tabIndex={0} onClick={() => onNavigate?.('saison')} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onNavigate?.('saison') }}>
        <img src={logoVision} alt="VZION" />
      </div>

      {/* Header race masqué pour le moment */}
      <div className="saison-topbar__race" style={{ display: 'none' }}>
        {/* Contenu masqué */}
      </div>

      {user === 'loading' ? null : user ? (
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
          <button
            className="saison-topbar__user-info"
            type="button"
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              console.log('[HeaderTopBar] Clic sur Mon compte')
              onNavigate?.('account')
            }}
            title="Mon compte"
            aria-label="Mon compte"
          >
            <span className="saison-topbar__user-name">
              {user.firstname && user.lastname ? `${user.firstname} ${user.lastname}` : user.email}
            </span>
          </button>
          <button
            className="saison-topbar__user-logout"
            type="button"
            onClick={handleLogout}
            title="Se déconnecter"
            aria-label="Se déconnecter"
          >
            <HiX />
          </button>
        </div>
      ) : (
        <div className="saison-topbar__actions">
          <button
            className="btn btn--ghost"
            type="button"
            onClick={() => {
              console.log('[HeaderTopBar] Bouton Se connecter cliqué')
              setLoginModalMode('login')
              setIsLoginModalOpen(true)
              console.log('[HeaderTopBar] State mis à jour')
            }}
          >
            Se connecter
          </button>
          <button
            className="btn btn--primary"
            type="button"
            onClick={() => {
              console.log('[HeaderTopBar] Bouton Créer un compte cliqué')
              setLoginModalMode('signup')
              setIsLoginModalOpen(true)
              console.log('[HeaderTopBar] State mis à jour')
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
