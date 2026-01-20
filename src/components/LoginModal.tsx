import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { HiX, HiEye, HiEyeOff } from 'react-icons/hi'
import { resetPasswordForEmail } from '../lib/auth'
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

// Schéma de validation pour la réinitialisation de mot de passe
const forgotPasswordSchema = z.object({
  email: z.string().email('Email invalide'),
})

type LoginFormData = z.infer<typeof loginSchema>
type SignupFormData = z.infer<typeof signupSchema>
type ForgotPasswordFormData = z.infer<typeof forgotPasswordSchema>

type LoginModalProps = {
  isOpen: boolean
  initialMode?: 'login' | 'signup' | 'forgot-password' | 'otp-expired'
  onClose: () => void
  onLogin?: (email: string, password: string) => Promise<void>
  onSignup?: (email: string, password: string) => Promise<void>
  onStravaConnect?: () => void
}

export default function LoginModal({ isOpen, initialMode = 'login', onClose, onLogin, onSignup, onStravaConnect }: LoginModalProps) {
  const [mode, setMode] = useState<'login' | 'signup' | 'forgot-password' | 'otp-expired'>(initialMode)
  const [isLoading, setIsLoading] = useState(false)
  const [resetEmailSent, setResetEmailSent] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)

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

  const {
    register: registerForgotPassword,
    handleSubmit: handleSubmitForgotPassword,
    formState: { errors: errorsForgotPassword },
    reset: resetForgotPassword,
  } = useForm<ForgotPasswordFormData>({
    resolver: zodResolver(forgotPasswordSchema),
  })

  // Détecter l'erreur otp_expired dans l'URL
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const hash = window.location.hash
      const searchParams = new URLSearchParams(window.location.search)
      
      // Vérifier dans le hash (#error_code=otp_expired)
      if (hash.includes('error_code=otp_expired') || searchParams.get('error_code') === 'otp_expired') {
        setMode('otp-expired')
        // Nettoyer l'URL
        const cleanUrl = window.location.href.split('#')[0].split('?')[0]
        window.history.replaceState({}, '', cleanUrl)
      }
    }
  }, [])

  // Mettre à jour le mode quand initialMode change ou quand la modal s'ouvre
  useEffect(() => {
    if (isOpen) {
      setMode(initialMode)
      // Réinitialiser les formulaires quand la modal s'ouvre
      resetLogin()
      resetSignup()
      resetForgotPassword()
      setResetEmailSent(false)
      setShowPassword(false)
      setShowConfirmPassword(false)
    }
  }, [isOpen, initialMode, resetLogin, resetSignup, resetForgotPassword])

  // Debug en production
  useEffect(() => {
    console.log('LoginModal - isOpen:', isOpen, 'mode:', mode, 'initialMode:', initialMode)
    if (isOpen) {
      console.log('LoginModal ouverte avec mode:', mode, 'initialMode:', initialMode)
    }
  }, [isOpen, mode, initialMode])

  // Ne pas retourner null, toujours rendre la structure mais la cacher avec CSS
  // Cela évite les problèmes de rendu en production
  // Utiliser une classe CSS au lieu de style inline pour éviter les problèmes de rendu
  if (!isOpen) {
    return (
      <div className="login-modal-overlay login-modal-overlay--hidden" aria-hidden="true" style={{ display: 'none', visibility: 'hidden' }}>
        <div className="login-modal" />
      </div>
    )
  }

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
    resetForgotPassword()
    setResetEmailSent(false)
  }

  const handleForgotPassword = async (data: ForgotPasswordFormData) => {
    setIsLoading(true)
    try {
      await resetPasswordForEmail(data.email)
      setResetEmailSent(true)
      resetForgotPassword()
    } catch (error) {
      console.error('Erreur lors de la demande de réinitialisation:', error)
      alert(error instanceof Error ? error.message : 'Erreur lors de la demande de réinitialisation')
    } finally {
      setIsLoading(false)
    }
  }

  const handleBackToLogin = () => {
    setMode('login')
    resetForgotPassword()
    setResetEmailSent(false)
  }

  return (
    <div className="login-modal-overlay" onClick={onClose}>
      <div className="login-modal" onClick={(e) => e.stopPropagation()}>
        <button className="login-modal__close" type="button" onClick={onClose} aria-label="Fermer">
          <HiX />
        </button>

        <div className="login-modal__header">
          <h2 className="login-modal__title">
            {mode === 'login' && 'Se connecter'}
            {mode === 'signup' && 'Créer un compte'}
            {(mode === 'forgot-password' || mode === 'otp-expired') && 'Mot de passe oublié'}
          </h2>
          <p className="login-modal__subtitle">
            {mode === 'login' && 'Connectez-vous pour accéder à votre compte'}
            {mode === 'signup' && 'Créez votre compte pour commencer'}
            {mode === 'forgot-password' && 'Entrez votre email pour recevoir un lien de réinitialisation'}
            {mode === 'otp-expired' && 'Le lien de réinitialisation a expiré. Veuillez en demander un nouveau.'}
          </p>
        </div>

        {(mode === 'forgot-password' || mode === 'otp-expired') ? (
          <>
            {resetEmailSent ? (
              <div className="login-modal__form">
                <div className="login-modal__success">
                  <p className="login-modal__success-message">
                    ✅ Un email de réinitialisation a été envoyé à votre adresse email.
                  </p>
                  <p className="login-modal__success-note">
                    Vérifiez votre boîte de réception et cliquez sur le lien pour réinitialiser votre mot de passe.
                  </p>
                  <button
                    type="button"
                    className="login-modal__submit"
                    onClick={handleBackToLogin}
                  >
                    Retour à la connexion
                  </button>
                </div>
              </div>
            ) : (
              <form className="login-modal__form" onSubmit={handleSubmitForgotPassword(handleForgotPassword)}>
                <div className="login-modal__field">
                  <label htmlFor="forgot-email">Email</label>
                  <input
                    id="forgot-email"
                    type="email"
                    placeholder="votre@email.com"
                    {...registerForgotPassword('email')}
                    className={errorsForgotPassword.email ? 'login-modal__input--error' : ''}
                  />
                  {errorsForgotPassword.email && (
                    <span className="login-modal__error">{errorsForgotPassword.email.message}</span>
                  )}
                </div>

                <button
                  type="submit"
                  className="login-modal__submit"
                  disabled={isLoading}
                >
                  {isLoading ? 'Envoi...' : 'Envoyer le lien de réinitialisation'}
                </button>

                <button
                  type="button"
                  className="login-modal__switch login-modal__switch--centered"
                  onClick={handleBackToLogin}
                >
                  Retour à la connexion
                </button>
              </form>
            )}
          </>
        ) : mode === 'login' ? (
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
              <div className="login-modal__password-wrapper">
                <input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  {...registerLogin('password')}
                  className={errorsLogin.password ? 'login-modal__input--error' : ''}
                />
                <button
                  type="button"
                  className="login-modal__password-toggle"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                >
                  {showPassword ? <HiEyeOff /> : <HiEye />}
                </button>
              </div>
              {errorsLogin.password && (
                <span className="login-modal__error">{errorsLogin.password.message}</span>
              )}
              <button
                type="button"
                onClick={() => setMode('forgot-password')}
                className="login-modal__forgot-link"
              >
                Mot de passe oublié ?
              </button>
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
              <div className="login-modal__password-wrapper">
                <input
                  id="signup-password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  {...registerSignup('password')}
                  className={errorsSignup.password ? 'login-modal__input--error' : ''}
                />
                <button
                  type="button"
                  className="login-modal__password-toggle"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                >
                  {showPassword ? <HiEyeOff /> : <HiEye />}
                </button>
              </div>
              {errorsSignup.password && (
                <span className="login-modal__error">{errorsSignup.password.message}</span>
              )}
            </div>

            <div className="login-modal__field">
              <label htmlFor="signup-confirm-password">Confirmer le mot de passe</label>
              <div className="login-modal__password-wrapper">
                <input
                  id="signup-confirm-password"
                  type={showConfirmPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  {...registerSignup('confirmPassword')}
                  className={errorsSignup.confirmPassword ? 'login-modal__input--error' : ''}
                />
                <button
                  type="button"
                  className="login-modal__password-toggle"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  aria-label={showConfirmPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                >
                  {showConfirmPassword ? <HiEyeOff /> : <HiEye />}
                </button>
              </div>
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

        {(mode === 'login' || mode === 'signup') && (
          <>
            <div className="login-modal__divider">
              <span>ou</span>
            </div>

            <button
              type="button"
              className="login-modal__strava"
              onClick={onStravaConnect}
              disabled={isLoading}
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                <path d="M15.387 17.944l-2.089-4.116h-3.065L15.387 24l5.15-10.172h-3.066m-7.008-5.599l2.836 5.599h4.172L10.463 0l-7.01 13.828h4.169" />
              </svg>
              {mode === 'login' ? 'Se connecter avec Strava' : 'S\'inscrire avec Strava'} (optionnel)
            </button>
            <p className="login-modal__strava-note">
              Vous pourrez connecter Strava plus tard depuis votre compte
            </p>

            <div className="login-modal__footer">
              <button type="button" className="login-modal__switch" onClick={handleModeSwitch}>
                {mode === 'login'
                  ? "Vous n'avez pas de compte ? Créer un compte"
                  : 'Vous avez déjà un compte ? Se connecter'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
