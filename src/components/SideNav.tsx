import './SideNav.css'

type SideNavProps = {
  activeItem?: 'saison' | 'events' | 'courses' | 'infos' | 'account'
  onNavigate?: (view: 'saison' | 'events' | 'courses' | 'course' | 'account') => void
}

export default function SideNav({ activeItem = 'saison', onNavigate }: SideNavProps) {
  return (
    <nav className="side-nav">
      <button
        className={`side-nav__item ${activeItem === 'saison' ? 'side-nav__item--active' : ''}`}
        type="button"
        onClick={() => onNavigate?.('saison')}
      >
        Saison
      </button>
      <button
        className={`side-nav__item ${activeItem === 'events' ? 'side-nav__item--active' : ''}`}
        type="button"
        onClick={() => onNavigate?.('events')}
      >
        Événements
      </button>
      <button
        className={`side-nav__item ${activeItem === 'courses' ? 'side-nav__item--active' : ''}`}
        type="button"
        onClick={() => onNavigate?.('courses')}
      >
        Courses
      </button>
      <button
        className={`side-nav__item ${activeItem === 'infos' ? 'side-nav__item--active' : ''}`}
        type="button"
      >
        Infos
      </button>
      <button
        className={`side-nav__item ${activeItem === 'account' ? 'side-nav__item--active' : ''}`}
        type="button"
        onClick={() => onNavigate?.('account')}
      >
        Mon compte
      </button>
    </nav>
  )
}
