import { useRef, useState } from 'react'

import './SaisonPage.css'

import gpxIcon from '../assets/d824ad10b22406bc6f779da5180da5cdaeca1e2c.svg'
import reunionFlag from '../assets/5375c6ef182ea756eeb23fb723865d5c353eb10b.png'
import grandRaidLogo from '../assets/da2a1ce5e69564e56a29b5912fd151a8f515e136.png'
import HeaderTopBar from '../components/HeaderTopBar'
import SideNav from '../components/SideNav'
import WorldMapSimple from '../components/WorldMapSimple'
import { gpxToSvg } from '../lib/gpxToSvg'

// Jeux de données temporaires pour la maquette MVP.
const raceCards = [
  {
    id: 'grand-raid-2026',
    year: '2026',
    title: 'Grand raid',
    subtitle: 'Diagonale des fous',
    stats: '165 km – 9 800 D+',
    readiness: '62%',
    countdown: '6 mois',
  },
]

type SaisonPageProps = {
  onCourseSelect?: () => void
  onNavigate?: (view: 'saison' | 'events' | 'courses' | 'course') => void
  onCreateEvent?: (payload: { name: string; imageUrl?: string }) => void
  onCreateCourse?: (payload: {
    name: string
    imageUrl?: string
    gpxName?: string
    gpxSvg?: string
    distanceKm?: number
    elevationGain?: number
    profile?: Array<[number, number]>
  }) => void
}

type CreateModalView = 'select' | 'event' | 'course'

export default function SaisonPage({
  onCourseSelect,
  onNavigate,
  onCreateEvent,
  onCreateCourse,
}: SaisonPageProps) {
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [createModalView, setCreateModalView] = useState<CreateModalView>('select')
  const eventNameRef = useRef<HTMLInputElement | null>(null)
  const eventImageRef = useRef<HTMLInputElement | null>(null)
  const courseNameRef = useRef<HTMLInputElement | null>(null)
  const courseImageRef = useRef<HTMLInputElement | null>(null)
  const courseGpxRef = useRef<HTMLInputElement | null>(null)

  const handleCreateEvent = () => {
    const name = eventNameRef.current?.value?.trim() || 'Sans titre'
    const file = eventImageRef.current?.files?.[0]
    const imageUrl = file ? URL.createObjectURL(file) : undefined

    onCreateEvent?.({ name, imageUrl })
    setIsCreateModalOpen(false)
    setCreateModalView('select')
    if (eventNameRef.current) eventNameRef.current.value = ''
    if (eventImageRef.current) eventImageRef.current.value = ''
  }

  const sanitizeSvg = (svgText: string) => {
    try {
      const parser = new DOMParser()
      const doc = parser.parseFromString(svgText, 'image/svg+xml')
      const svg = doc.querySelector('svg')
      if (!svg) return svgText

      const widthAttr = svg.getAttribute('width')
      const heightAttr = svg.getAttribute('height')
      if (!svg.getAttribute('viewBox') && widthAttr && heightAttr) {
        svg.setAttribute('viewBox', `0 0 ${widthAttr} ${heightAttr}`)
      }
      svg.setAttribute('preserveAspectRatio', 'xMidYMid meet')
      svg.removeAttribute('width')
      svg.removeAttribute('height')

      svg.querySelectorAll('rect,text,circle').forEach((node) => node.remove())

      const pathLike = svg.querySelector('polyline, path')
      if (pathLike) {
        pathLike.setAttribute('stroke', '#b2aaaa') // gris clair proche maquette
        pathLike.setAttribute('stroke-width', '2')
        pathLike.setAttribute('fill', 'none')
        pathLike.setAttribute('stroke-linecap', 'round')
        pathLike.setAttribute('stroke-linejoin', 'round')
        pathLike.setAttribute('opacity', '0.9')
      }

      return svg.outerHTML
    } catch (error) {
      console.error('Erreur lors du nettoyage SVG', error)
      return svgText
    }
  }

  const parseGpxStats = (gpxText: string) => {
    try {
      const parser = new DOMParser()
      const doc = parser.parseFromString(gpxText, 'application/xml')
      const points = Array.from(doc.querySelectorAll('trkpt, rtept'))
      const coords = points
        .map((pt) => {
          const lat = Number(pt.getAttribute('lat'))
          const lon = Number(pt.getAttribute('lon'))
          const eleNode = pt.querySelector('ele')
          const ele = eleNode ? Number(eleNode.textContent) : undefined
          if (Number.isNaN(lat) || Number.isNaN(lon)) return null
          return { lat, lon, ele }
        })
        .filter((pt): pt is { lat: number; lon: number; ele: number | undefined } => pt !== null)

      if (coords.length < 2) {
        return { distanceKm: undefined, elevationGain: undefined }
      }

      const toRad = (value: number) => (value * Math.PI) / 180
      const haversineKm = (a: typeof coords[number], b: typeof coords[number]) => {
        const R = 6371
        const dLat = toRad(b.lat - a.lat)
        const dLon = toRad(b.lon - a.lon)
        const lat1 = toRad(a.lat)
        const lat2 = toRad(b.lat)
        const h =
          Math.sin(dLat / 2) * Math.sin(dLat / 2) +
          Math.sin(dLon / 2) * Math.sin(dLon / 2) * Math.cos(lat1) * Math.cos(lat2)
        return 2 * R * Math.asin(Math.sqrt(h))
      }

      let distanceKm = 0
      let elevationGain = 0
      const profile: Array<[number, number]> = []

      for (let i = 1; i < coords.length; i += 1) {
        const prev = coords[i - 1]
        const curr = coords[i]
        distanceKm += haversineKm(prev, curr)
        if (prev.ele !== undefined && curr.ele !== undefined) {
          const delta = curr.ele - prev.ele
          if (delta > 0) elevationGain += delta
        }
        // Échantillonner tous les ~10 points pour alléger la série
        if (i % 10 === 0 && curr.ele !== undefined) {
          profile.push([Number(distanceKm.toFixed(2)), Math.round(curr.ele)])
        }
      }
      // Ajouter le dernier point
      const last = coords.at(-1)
      if (last && last.ele !== undefined) {
        profile.push([Number(distanceKm.toFixed(2)), Math.round(last.ele)])
      }

      return {
        distanceKm,
        elevationGain: elevationGain || undefined,
        profile,
      }
    } catch (error) {
      console.error('Erreur lors du calcul des stats GPX', error)
      return { distanceKm: undefined, elevationGain: undefined, profile: undefined }
    }
  }

  const handleCreateCourse = async () => {
    const name = courseNameRef.current?.value?.trim() || 'Sans titre'
    const imageFile = courseImageRef.current?.files?.[0]
    const gpxFile = courseGpxRef.current?.files?.[0]
    const imageUrl = imageFile ? URL.createObjectURL(imageFile) : undefined
    const gpxName = gpxFile?.name
    let gpxSvg: string | undefined
    let distanceKm: number | undefined
    let elevationGain: number | undefined
    let profile: Array<[number, number]> | undefined

    setIsCreateModalOpen(false)
    setCreateModalView('select')
    onNavigate?.('courses')

    if (gpxFile) {
      try {
        const gpxText = await gpxFile.text()
        const stats = parseGpxStats(gpxText)
        distanceKm = stats.distanceKm
        elevationGain = stats.elevationGain
        profile = stats.profile
        // Conversion GPX → SVG côté client (fonctionne en production)
        const rawSvg = gpxToSvg(gpxText)
        gpxSvg = sanitizeSvg(rawSvg)
      } catch (error) {
        console.error('Erreur lors de la conversion GPX → SVG', error)
      }
    }

      onCreateCourse?.({ name, imageUrl, gpxName, gpxSvg, distanceKm, elevationGain, profile })
    if (courseNameRef.current) courseNameRef.current.value = ''
    if (courseImageRef.current) courseImageRef.current.value = ''
    if (courseGpxRef.current) courseGpxRef.current.value = ''
  }

  return (
    <div className="saison-page">
      <HeaderTopBar onNavigate={onNavigate} />

      <div className="saison-body">
        <aside className="saison-side">
          <SideNav activeItem="saison" onNavigate={onNavigate} />
        </aside>

        <main className="saison-main">
          <section className="saison-heading">
            <div>
              <p className="saison-title">SAISON 2026</p>
              <p className="saison-subtitle">Aucune course ou événement pour le moment</p>
            </div>
            <button
              className="info-card"
              type="button"
              onClick={() => {
                setCreateModalView('select')
                setIsCreateModalOpen(true)
              }}
            >
              <div>
                <p className="info-card__title">Ajouter un événement ou une course</p>
                <p className="info-card__subtitle">Commencer dès à présent à vous préparez</p>
              </div>
              <span className="info-card__chevron" aria-hidden="true">
                ›
              </span>
            </button>
          </section>

          <div className="saison-map-block">
            <section className="map-section">
              <div className="map-wrapper">
                <WorldMapSimple onCourseSelect={onCourseSelect} />
              </div>
            </section>

            <section className="courses-section">
              <div className="courses-heading">
                <p className="courses-title">Mes courses en cours</p>
                <p className="courses-subtitle">Vous n’avez pas encore de course en cours.</p>
              </div>
              <div className="courses-carousel">
                {raceCards.map((card) => (
                  <article
                    key={card.id}
                    className="race-card"
                    role="button"
                    tabIndex={0}
                    onClick={onCourseSelect}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        onCourseSelect?.()
                      }
                    }}
                  >
                    <header className="race-card__header">
                      <span>{card.title}</span>
                      <span>{card.year}</span>
                      <span className="race-card__flag">
                        <img src={reunionFlag} alt="" aria-hidden="true" />
                      </span>
                    </header>
                    <div className="race-card__image">
                      <img src={grandRaidLogo} alt="Grand Raid" />
                    </div>
                    <div className="race-card__content">
                      <div>
                        <p>{card.subtitle}</p>
                        <p>{card.stats}</p>
                      </div>
                      <img src={gpxIcon} alt="GPX" />
                    </div>
                    <footer className="race-card__footer">
                      <div>
                        <p>
                          État de préparation : <strong>{card.readiness}</strong>
                        </p>
                      </div>
                      <div>
                        <p>Début de la course</p>
                        <p className="race-card__countdown">{card.countdown}</p>
                      </div>
                    </footer>
                  </article>
                ))}
              </div>
            </section>
          </div>
        </main>
      </div>

      {isCreateModalOpen && (
        <div className="modal-overlay" role="dialog" aria-modal="true">
          {createModalView === 'select' && (
            <div className="modal">
              <header className="modal__header">
                <h2>Ajouter un événement ou une course</h2>
                <button
                  type="button"
                  className="modal__close"
                  onClick={() => setIsCreateModalOpen(false)}
                  aria-label="Fermer"
                >
                  ×
                </button>
              </header>
              <p className="modal__subtitle">Description</p>
              <button
                className="modal-card"
                type="button"
                onClick={() => setCreateModalView('event')}
              >
                <div>
                  <p className="modal-card__title">Créer un événement</p>
                  <p className="modal-card__text">
                    Un événement vous permet de regrouper plusieurs course.
                  </p>
                </div>
                <span aria-hidden="true">›</span>
              </button>
              <button
                className="modal-card"
                type="button"
                onClick={() => setCreateModalView('course')}
              >
                <div>
                  <p className="modal-card__title">Créer une course</p>
                  <p className="modal-card__text">
                    Importer votre gpx et commencer à vous préparer pour le jour-j
                  </p>
                </div>
                <span aria-hidden="true">›</span>
              </button>
              <button
                className="modal-back"
                type="button"
                onClick={() => setIsCreateModalOpen(false)}
              >
                Retour
              </button>
            </div>
          )}

          {createModalView === 'event' && (
            <div className="modal modal--form">
              <header className="modal__header modal__header--center">
                <h2>Crée ton événement</h2>
                <button
                  type="button"
                  className="modal__close"
                  onClick={() => setIsCreateModalOpen(false)}
                  aria-label="Fermer"
                >
                  ×
                </button>
              </header>
              <p className="modal__subtitle modal__subtitle--left">
                Un événement vous permet de regrouper plusieurs course.
              </p>
              <div className="modal-upload">
                <label className="modal-upload__circle" htmlFor="event-image">
                  <span className="modal-upload__icon">image-polaroid</span>
                </label>
                <label className="modal-upload__plus" htmlFor="event-image">
                  +
                </label>
                <input
                  id="event-image"
                  className="modal-upload__input"
                  type="file"
                  accept="image/*"
                  ref={eventImageRef}
                />
              </div>
              <div className="modal-field">
                <label htmlFor="event-name">
                  Nom de l’événement<span className="modal-field__required">*</span>
                </label>
                <input
                  id="event-name"
                  className="modal-input"
                  type="text"
                  placeholder="UTMB"
                  ref={eventNameRef}
                />
              </div>
              <p className="modal-footnote">
                En créant un événement tu accepte la charte d’utilisation de communauté.
              </p>
              <div className="modal-actions">
                <button className="modal-back" type="button" onClick={() => setCreateModalView('select')}>
                  Retour
                </button>
                <button className="modal-primary" type="button" onClick={handleCreateEvent}>
                  Créer
                </button>
              </div>
            </div>
          )}

          {createModalView === 'course' && (
            <div className="modal modal--form">
              <header className="modal__header modal__header--center">
                <h2>Crée ta course</h2>
                <button
                  type="button"
                  className="modal__close"
                  onClick={() => setIsCreateModalOpen(false)}
                  aria-label="Fermer"
                >
                  ×
                </button>
              </header>
              <p className="modal__subtitle">Un événement vous permet de regrouper plusieurs course.</p>
              <div className="modal-upload modal-upload--double">
                <div className="modal-upload__block">
                  <label className="modal-upload__circle" htmlFor="course-image">
                    <span className="modal-upload__icon">image-polaroid</span>
                    <span className="modal-upload__label">Upload img</span>
                  </label>
                  <label className="modal-upload__plus" htmlFor="course-image">
                    +
                  </label>
                  <input
                    id="course-image"
                    className="modal-upload__input"
                    type="file"
                    accept="image/*"
                  ref={courseImageRef}
                  />
                </div>
                <div className="modal-upload__block">
                  <label className="modal-upload__circle" htmlFor="course-gpx">
                    <span className="modal-upload__icon">route</span>
                    <span className="modal-upload__label">Upload gpx</span>
                  </label>
                  <label className="modal-upload__plus" htmlFor="course-gpx">
                    +
                  </label>
                  <input
                    id="course-gpx"
                    className="modal-upload__input"
                    type="file"
                    accept=".gpx,application/gpx+xml,application/xml,text/xml"
                  ref={courseGpxRef}
                  />
                </div>
              </div>
              <div className="modal-field">
                <label htmlFor="course-name">
                  Nom de la course<span className="modal-field__required">*</span>
                </label>
                <input
                  id="course-name"
                  className="modal-input"
                  type="text"
                  placeholder="UTMB"
                  ref={courseNameRef}
                />
              </div>
              <p className="modal-footnote">
                En créant une course tu accepte{' '}
                <span className="modal-footnote__link">la charte d’utilisation de communauté.</span>
              </p>
              <div className="modal-actions">
                <button className="modal-back" type="button" onClick={() => setCreateModalView('select')}>
                  Retour
                </button>
                <button className="modal-primary" type="button" onClick={handleCreateCourse}>
                  Créer
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
