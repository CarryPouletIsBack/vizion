import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import './LoginModal.css'

// Schéma de validation pour le login
const loginSchema = z.object({
  email: z.string().email('Email invalide'),
  password: z.string().min(6, 'Le mot de passe doit contenir au moins 6 caractères'),
})

// Schéma de validation pour l'inscription
const signupSchema = z.object({
  email: z.string().email('Email invalide'),
  password: z.string().min(6, 'Le mot de passe doit contenir au moins 6 caractères'),
  confirmPassword: z.string().min(6, 'Le mot de passe doit contenir au moins 6 caractères'),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Les mots de passe ne correspondent pas',
  path: ['confirmPassword'],
})

type LoginFormData = z.infer<typeof loginSchema>
type SignupFormData = z.infer<typeof signupSchema>

type LoginModalProps = {
  isOpen: boolean
  initialMode?: 'login' | 'signup'
  onClose: () => void
  onLogin?: (email: string, password: string) => Promise<void>
  onSignup?: (email: string, password: string) => Promise<void>
  onStravaConnect?: () => void
}

export default function LoginModal({ isOpen, initialMode = 'login', onClose, onLogin, onSignup, onStravaConnect }: LoginModalProps) {
  const [mode, setMode] = useState<'login' | 'signup'>(initialMode)
  const [isLoading, setIsLoading] = useState(false)

  const {
    register: registerLogin,
    handleSubmit: handleSubmitLogin,
    formState: { errors: errorsLogin },
    reset: resetLogin,
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
  })

  const {
    register: registerSignup,
    handleSubmit: handleSubmitSignup,
    formState: { errors: errorsSignup },
    reset: resetSignup,
  } = useForm<SignupFormData>({
    resolver: zodResolver(signupSchema),
  })

  // Mettre à jour le mode quand initialMode change ou quand la modal s'ouvre
  useEffect(() => {
    if (isOpen) {
      setMode(initialMode)
      // Réinitialiser les formulaires quand la modal s'ouvre
      resetLogin()
      resetSignup()
    }
  }, [isOpen, initialMode, resetLogin, resetSignup])

  if (!isOpen) return null

  const handleLogin = async (data: LoginFormData) => {
    setIsLoading(true)
    try {
      await onLogin?.(data.email, data.password)
      resetLogin()
      onClose()
    } catch (error) {
      console.error('Erreur lors de la connexion:', error)
      alert(error instanceof Error ? error.message : 'Erreur lors de la connexion')
    } finally {
      setIsLoading(false)
    }
  }

  const handleSignup = async (data: SignupFormData) => {
    setIsLoading(true)
    try {
      await onSignup?.(data.email, data.password)
      resetSignup()
      onClose()
    } catch (error) {
      console.error('Erreur lors de l\'inscription:', error)
      alert(error instanceof Error ? error.message : 'Erreur lors de l\'inscription')
    } finally {
      setIsLoading(false)
    }
  }

  const handleModeSwitch = () => {
    setMode(mode === 'login' ? 'signup' : 'login')
    resetLogin()
    resetSignup()
  }

  return (
    <div className="login-modal-overlay" onClick={onClose}>
      <div className="login-modal" onClick={(e) => e.stopPropagation()}>
        <button className="login-modal__close" type="button" onClick={onClose} aria-label="Fermer">
          ×
        </button>

        <div className="login-modal__header">
          <h2 className="login-modal__title">{mode === 'login' ? 'Se connecter' : 'Créer un compte'}</h2>
          <p className="login-modal__subtitle">
            {mode === 'login'
              ? 'Connectez-vous pour accéder à votre compte'
              : 'Créez votre compte pour commencer'}
          </p>
        </div>

        {mode === 'login' ? (
          <form className="login-modal__form" onSubmit={handleSubmitLogin(handleLogin)}>
            <div className="login-modal__field">
              <label htmlFor="login-email">Email</label>
              <input
                id="login-email"
                type="email"
                placeholder="votre@email.com"
                {...registerLogin('email')}
                className={errorsLogin.email ? 'login-modal__input--error' : ''}
              />
              {errorsLogin.email && (
                <span className="login-modal__error">{errorsLogin.email.message}</span>
              )}
            </div>

            <div className="login-modal__field">
              <label htmlFor="login-password">Mot de passe</label>
              <input
                id="login-password"
                type="password"
                placeholder="••••••••"
                {...registerLogin('password')}
                className={errorsLogin.password ? 'login-modal__input--error' : ''}
              />
              {errorsLogin.password && (
                <span className="login-modal__error">{errorsLogin.password.message}</span>
              )}
            </div>

            <button
              type="submit"
              className="login-modal__submit"
              disabled={isLoading}
            >
              {isLoading ? 'Connexion...' : 'Se connecter'}
            </button>
          </form>
        ) : (
          <form className="login-modal__form" onSubmit={handleSubmitSignup(handleSignup)}>
            <div className="login-modal__field">
              <label htmlFor="signup-email">Email</label>
              <input
                id="signup-email"
                type="email"
                placeholder="votre@email.com"
                {...registerSignup('email')}
                className={errorsSignup.email ? 'login-modal__input--error' : ''}
              />
              {errorsSignup.email && (
                <span className="login-modal__error">{errorsSignup.email.message}</span>
              )}
            </div>

            <div className="login-modal__field">
              <label htmlFor="signup-password">Mot de passe</label>
              <input
                id="signup-password"
                type="password"
                placeholder="••••••••"
                {...registerSignup('password')}
                className={errorsSignup.password ? 'login-modal__input--error' : ''}
              />
              {errorsSignup.password && (
                <span className="login-modal__error">{errorsSignup.password.message}</span>
              )}
            </div>

            <div className="login-modal__field">
              <label htmlFor="signup-confirm-password">Confirmer le mot de passe</label>
              <input
                id="signup-confirm-password"
                type="password"
                placeholder="••••••••"
                {...registerSignup('confirmPassword')}
                className={errorsSignup.confirmPassword ? 'login-modal__input--error' : ''}
              />
              {errorsSignup.confirmPassword && (
                <span className="login-modal__error">{errorsSignup.confirmPassword.message}</span>
              )}
            </div>

            <button
              type="submit"
              className="login-modal__submit"
              disabled={isLoading}
            >
              {isLoading ? 'Création...' : 'Créer un compte'}
            </button>
          </form>
        )}

        <div className="login-modal__divider">
          <span>ou</span>
        </div>

        <button
          type="button"
          className="login-modal__strava"
          onClick={onStravaConnect}
          disabled={isLoading}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
            <path d="M15.387 17.944l-2.089-4.116h-3.065L15.387 24l5.15-10.172h-3.066m-7.008-5.599l2.836 5.599h4.172L10.463 0l-7.01 13.828h4.169" />
          </svg>
          Se connecter avec Strava
        </button>

        <div className="login-modal__footer">
          <button type="button" className="login-modal__switch" onClick={handleModeSwitch}>
            {mode === 'login'
              ? "Vous n'avez pas de compte ? Créer un compte"
              : 'Vous avez déjà un compte ? Se connecter'}
          </button>
        </div>
      </div>
    </div>
  )
}
