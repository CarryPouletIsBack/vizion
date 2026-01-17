import './HeaderTopBar.css'

import logoVision from '../assets/c5c94aad0b681f3e62439f66f02703ba7c8b5826.svg'
import { redirectToStravaAuth } from '../lib/stravaAuth'

type HeaderTopBarProps = {
  onNavigate?: (view: 'saison' | 'events' | 'courses' | 'course') => void
}

export default function HeaderTopBar({ onNavigate }: HeaderTopBarProps) {
  const handleStravaConnect = () => {
    redirectToStravaAuth()
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

      <div className="saison-topbar__actions">
        <button className="btn btn--ghost" type="button" onClick={handleStravaConnect}>
          Se connecter
        </button>
        <button className="btn btn--primary" type="button">
          Créer un compte
        </button>
      </div>
    </header>
  )
}
