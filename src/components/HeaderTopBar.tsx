import './HeaderTopBar.css'

import logoVision from '../assets/c5c94aad0b681f3e62439f66f02703ba7c8b5826.svg'
import reunionFlag from '../assets/5375c6ef182ea756eeb23fb723865d5c353eb10b.png'

export default function HeaderTopBar() {
  return (
    <header className="saison-topbar">
      <div className="saison-topbar__logo">
        <img src={logoVision} alt="VZION" />
      </div>

      <div className="saison-topbar__race">
        <div className="race-tag">
          <span>GRAND RAID – DIAGONALE DES FOUS</span>
          <span className="race-tag__flag">
            <img src={reunionFlag} alt="Drapeau de La Reunion" />
          </span>
        </div>
        <p className="race-meta">175 km · 10 150 D+ · Août 2026</p>
        <div className="race-progress">
          <div className="race-progress__bar" />
          <span>65%</span>
        </div>
      </div>

      <div className="saison-topbar__actions">
        <button className="btn btn--ghost" type="button">
          Se connecter
        </button>
        <button className="btn btn--primary" type="button">
          Créer un compte
        </button>
      </div>
    </header>
  )
}
