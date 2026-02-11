import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { HiX } from 'react-icons/hi'
import { FiChevronDown } from 'react-icons/fi'

import './SaisonPage.css'

import HeaderTopBar from '../components/HeaderTopBar'
import SearchBar from '../components/SearchBar'
import { getCurrentUser } from '../lib/auth'
import { getMySelectedCourseIds } from '../lib/userCourseSelections'
import { gpxToSvg, extractGpxStartCoordinates, extractGpxWaypoints, getBoundsFromGpx } from '../lib/gpxToSvg'
import { extractRouteIdFromUrl } from '../lib/stravaRouteParser'

type EventWithCourses = {
  id: string
  name: string
  courses: Array<{
    id: string
    name: string
    startCoordinates?: [number, number]
    gpxSvg?: string
    distanceKm?: number
    elevationGain?: number
  }>
}

type SaisonPageProps = {
  events?: EventWithCourses[]
  onCourseSelect?: (courseId?: string) => void
  onNavigate?: (view: 'saison' | 'events' | 'courses' | 'course' | 'account') => void
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
  events = [],
  onCourseSelect: _onCourseSelect,
  onNavigate,
  onCreateEvent,
  onCreateCourse,
}: SaisonPageProps) {
  /** Toutes les courses chargées depuis Supabase (events) — affichées sous SAISON 2026 */
  const allCoursesFromEvents = useMemo(() => {
    return events.flatMap((ev) => ev.courses)
  }, [events])

  const [searchTerm, setSearchTerm] = useState('')
  const [isSearchActive, setIsSearchActive] = useState(false)
  const searchWrapRef = useRef<HTMLDivElement>(null)

  type FilterKey = 'pays' | 'distance' | 'date'
  const [openFilter, setOpenFilter] = useState<FilterKey | null>(null)
  const filtersRef = useRef<HTMLDivElement>(null)
  const [filterPays, setFilterPays] = useState<string>('Tous les pays')
  const [filterDistance, setFilterDistance] = useState<string>('Toutes distances')
  const [filterDate, setFilterDate] = useState<string>('Toutes dates')
  const PAYS_OPTIONS = ['Tous les pays', 'France', 'Suisse', 'Italie', 'Espagne']
  const DISTANCE_OPTIONS = ['Toutes distances', '< 20 km', '20–50 km', '50–100 km', '> 100 km']
  const DATE_OPTIONS = ['Toutes dates', '2026', '2025', 'À venir']

  const filteredCoursesForList = useMemo(() => {
    if (!searchTerm.trim()) return allCoursesFromEvents
    const term = searchTerm.toLowerCase().trim()
    return allCoursesFromEvents.filter((c) => c.name.toLowerCase().includes(term))
  }, [allCoursesFromEvents, searchTerm])

  const [mySelectedCourseIds, setMySelectedCourseIds] = useState<Set<string>>(new Set())
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const refreshMyParcours = useCallback(() => {
    Promise.all([getCurrentUser(), getMySelectedCourseIds()]).then(([user, ids]) => {
      setCurrentUserId(user?.id ?? null)
      setMySelectedCourseIds(ids)
    })
  }, [])

  useEffect(() => {
    refreshMyParcours()
  }, [events, refreshMyParcours])

  useEffect(() => {
    const handler = () => refreshMyParcours()
    window.addEventListener('my-parcours-changed', handler)
    return () => window.removeEventListener('my-parcours-changed', handler)
  }, [refreshMyParcours])

  useEffect(() => {
    if (!isSearchActive) return
    const handleClickOutside = (e: MouseEvent | TouchEvent) => {
      const target = e.target as Node
      if (searchWrapRef.current && !searchWrapRef.current.contains(target)) {
        setIsSearchActive(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('touchstart', handleClickOutside, { passive: true })
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('touchstart', handleClickOutside)
    }
  }, [isSearchActive])

  useEffect(() => {
    if (openFilter === null) return
    const handleClickOutside = (e: MouseEvent | TouchEvent) => {
      const target = e.target as Node
      if (filtersRef.current && !filtersRef.current.contains(target)) {
        setOpenFilter(null)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('touchstart', handleClickOutside, { passive: true })
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('touchstart', handleClickOutside)
    }
  }, [openFilter])

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [createModalView, setCreateModalView] = useState<CreateModalView>('select')
  const eventNameRef = useRef<HTMLInputElement | null>(null)
  const eventImageRef = useRef<HTMLInputElement | null>(null)
  const courseNameRef = useRef<HTMLInputElement | null>(null)
  const courseImageRef = useRef<HTMLInputElement | null>(null)
  const courseGpxRef = useRef<HTMLInputElement | null>(null)
  const courseStravaRouteRef = useRef<HTMLInputElement | null>(null)
  const coursePublishRef = useRef<HTMLInputElement | null>(null)

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
      if (!svgText || typeof svgText !== 'string') return svgText
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
      if (!gpxText || typeof gpxText !== 'string') return { distanceKm: 0, elevationGain: 0, profile: [] }
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
    if (!name || name.toLowerCase() === 'sans titre') {
      alert('Veuillez entrer un nom de parcours valide')
      return
    }

    const imageFile = courseImageRef.current?.files?.[0]
    const gpxFile = courseGpxRef.current?.files?.[0]
    const stravaRouteUrl = courseStravaRouteRef.current?.value?.trim()
    const imageUrl = imageFile ? URL.createObjectURL(imageFile) : undefined
    const gpxName = gpxFile?.name
    
    let gpxSvg: string | undefined
    let distanceKm: number | undefined
    let elevationGain: number | undefined
    let profile: Array<[number, number]> | undefined
    let stravaRouteId: string | undefined
    let stravaSegments: Array<{
      id: number
      name: string
      distance: number
      elevation_gain: number
      average_grade: number
      type: 'climb' | 'descent' | 'flat'
    }> | undefined

    // Traiter le GPX d'abord
    let startCoordinates: [number, number] | undefined
    let gpxBounds: { minLat: number; maxLat: number; minLon: number; maxLon: number } | undefined
    if (gpxFile) {
      try {
        const gpxText = await gpxFile.text()
        const stats = parseGpxStats(gpxText)
        distanceKm = stats.distanceKm
        elevationGain = stats.elevationGain
        profile = stats.profile
        
        // Extraire les coordonnées de départ et les bornes pour la carte
        startCoordinates = extractGpxStartCoordinates(gpxText) || undefined
        gpxBounds = getBoundsFromGpx(gpxText) ?? undefined
        
        extractGpxWaypoints(gpxText)
        // Conversion GPX → SVG côté client (fonctionne en production)
        const rawSvg = gpxToSvg(gpxText)
        gpxSvg = sanitizeSvg(rawSvg)
      } catch (error) {
        console.error('❌ Erreur lors de la conversion GPX → SVG', error)
      }
    }

    // Extraire l'ID de route depuis l'URL Strava (optionnel, ne bloque pas la création)
    if (stravaRouteUrl) {
      stravaRouteId = extractRouteIdFromUrl(stravaRouteUrl) || undefined
      if (stravaRouteId) {
        // Récupérer les segments depuis l'API Strava (non bloquant)
        try {
          // Récupérer le token depuis localStorage
          const tokenData = localStorage.getItem('trackali:strava_token')
          if (tokenData) {
            const token = JSON.parse(tokenData)
            
            // 1. Récupérer les segments de la route
            const segmentsResponse = await fetch(`/api/strava/route-segments?route_id=${stravaRouteId}`, {
              headers: {
                Authorization: `Bearer ${token.access_token}`,
              },
            })

            if (segmentsResponse.ok) {
              const segmentsData = await segmentsResponse.json()
              stravaSegments = segmentsData.segments || undefined
              // 2. Récupérer les performances du coureur sur cette route (pour améliorer l'analyse)
              try {
                const performanceResponse = await fetch(`/api/strava/route-performance?route_id=${stravaRouteId}`, {
                  headers: {
                    Authorization: `Bearer ${token.access_token}`,
                  },
                })
                
                if (performanceResponse.ok) {
                  const performanceData = await performanceResponse.json()
                  
                  // Enrichir les segments avec les performances
                  if (stravaSegments && performanceData.segment_performance) {
                    stravaSegments = stravaSegments.map((seg: any) => {
                      const perf = performanceData.segment_performance.find((p: any) => p.segment_id === seg.id)
                      if (perf) {
                        return {
                          ...seg,
                          best_time: perf.best_time,
                          average_time: perf.average_time,
                          attempts: perf.attempts,
                          last_attempt_date: perf.last_attempt_date,
                        }
                      }
                      return seg
                    })
                  }
                } else {
                  console.warn('⚠️ Impossible de récupérer les performances (non bloquant)')
                }
              } catch (perfError) {
                console.warn('⚠️ Erreur lors de la récupération des performances (non bloquant):', perfError)
              }
            } else {
              const errorText = await segmentsResponse.text()
              console.warn('⚠️ Impossible de récupérer les segments Strava:', errorText)
              // Ne pas bloquer la création si les segments échouent
            }
          } else {
            console.warn('⚠️ Pas de token Strava, segments non récupérés')
          }
        } catch (error) {
          console.error('❌ Erreur lors de la récupération des segments Strava:', error)
          // Ne pas bloquer la création si les segments échouent
        }
      } else {
        console.warn('⚠️ Impossible d\'extraire l\'ID de route depuis l\'URL')
      }
    }

    // Préparer les données pour la création
    const courseData = {
      name,
      imageUrl,
      gpxName,
      gpxSvg,
      distanceKm,
      elevationGain,
      profile,
      isPublished: coursePublishRef.current?.checked ?? false,
      ...(startCoordinates && { startCoordinates }),
      ...(gpxBounds && { gpxBounds }),
      ...(stravaRouteId && { stravaRouteId }),
      ...(stravaSegments && stravaSegments.length > 0 && { stravaSegments }),
    }
    
    // Fermer la modale et naviguer
    setIsCreateModalOpen(false)
    setCreateModalView('select')
    onNavigate?.('courses')

    // Appeler la fonction de création (asynchrone)
    try {
      await onCreateCourse?.(courseData)
    } catch (error) {
      console.error('❌ Erreur lors de l\'appel onCreateCourse:', error)
      alert('Erreur lors de la création du parcours. Vérifiez la console pour plus de détails.')
    }

    // Réinitialiser les champs
    if (courseNameRef.current) courseNameRef.current.value = ''
    if (courseImageRef.current) courseImageRef.current.value = ''
    if (courseGpxRef.current) courseGpxRef.current.value = ''
    if (courseStravaRouteRef.current) courseStravaRouteRef.current.value = ''
  }

  return (
    <div className="saison-page">
      <HeaderTopBar onNavigate={onNavigate} />

      <div className="saison-body">
        <main className="saison-main">
          <div className="saison-search-and-filters">
          <div className="saison-search-wrap" ref={searchWrapRef}>
            <div className={`saison-search-bar-wrap ${isSearchActive ? 'saison-search-bar-wrap--active' : ''}`}>
              <SearchBar
                placeholder="Rechercher un parcours…"
                value={searchTerm}
                onChange={setSearchTerm}
                onFocus={() => setIsSearchActive(true)}
                aria-label="Rechercher un parcours"
              />
              {isSearchActive && (
                <div className="saison-search-results">
                  {filteredCoursesForList.length === 0 ? (
                    <p className="saison-search-results__empty">Aucun parcours</p>
                  ) : (
                    <ul className="saison-search-results__list" role="list">
                      {filteredCoursesForList.map((course) => (
                        <li key={course.id}>
                          <button
                            type="button"
                            className="saison-search-results__item"
                            onClick={() => {
                              _onCourseSelect?.(course.id)
                              setIsSearchActive(false)
                            }}
                          >
                            <span className="saison-search-results__item-gpx">
                              {course.gpxSvg ? (
                                <span className="saison-search-results__item-gpx-svg" dangerouslySetInnerHTML={{ __html: course.gpxSvg }} />
                              ) : (
                                <span className="saison-search-results__item-gpx-placeholder" aria-hidden />
                              )}
                            </span>
                            <span className="saison-search-results__item-content">
                              <span className="saison-search-results__item-title">{course.name}</span>
                              {course.distanceKm != null && course.elevationGain != null && (
                                <span className="saison-search-results__item-stats">
                                  {course.distanceKm.toFixed(0)} km · {Math.round(course.elevationGain)} D+
                                </span>
                              )}
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="saison-filters" ref={filtersRef}>
            <div className="saison-filters__row">
              <div className="saison-filter-dropdown">
                <button
                  type="button"
                  className="saison-filter-dropdown-button"
                  onClick={() => setOpenFilter(openFilter === 'pays' ? null : 'pays')}
                  aria-expanded={openFilter === 'pays'}
                  aria-haspopup="listbox"
                  aria-label="Filtrer par pays"
                >
                  <span>{filterPays}</span>
                  <FiChevronDown className="saison-filter-dropdown-icon" aria-hidden />
                </button>
                {openFilter === 'pays' && (
                  <ul className="saison-filter-dropdown-menu" role="listbox">
                    {PAYS_OPTIONS.map((opt) => (
                      <li key={opt}>
                        <button
                          type="button"
                          role="option"
                          aria-selected={filterPays === opt}
                          className="saison-filter-dropdown-item"
                          onClick={() => {
                            setFilterPays(opt)
                            setOpenFilter(null)
                          }}
                        >
                          {opt}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div className="saison-filter-dropdown">
                <button
                  type="button"
                  className="saison-filter-dropdown-button"
                  onClick={() => setOpenFilter(openFilter === 'distance' ? null : 'distance')}
                  aria-expanded={openFilter === 'distance'}
                  aria-haspopup="listbox"
                  aria-label="Filtrer par distance"
                >
                  <span>{filterDistance}</span>
                  <FiChevronDown className="saison-filter-dropdown-icon" aria-hidden />
                </button>
                {openFilter === 'distance' && (
                  <ul className="saison-filter-dropdown-menu" role="listbox">
                    {DISTANCE_OPTIONS.map((opt) => (
                      <li key={opt}>
                        <button
                          type="button"
                          role="option"
                          aria-selected={filterDistance === opt}
                          className="saison-filter-dropdown-item"
                          onClick={() => {
                            setFilterDistance(opt)
                            setOpenFilter(null)
                          }}
                        >
                          {opt}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div className="saison-filter-dropdown">
                <button
                  type="button"
                  className="saison-filter-dropdown-button"
                  onClick={() => setOpenFilter(openFilter === 'date' ? null : 'date')}
                  aria-expanded={openFilter === 'date'}
                  aria-haspopup="listbox"
                  aria-label="Filtrer par date"
                >
                  <span>{filterDate}</span>
                  <FiChevronDown className="saison-filter-dropdown-icon" aria-hidden />
                </button>
                {openFilter === 'date' && (
                  <ul className="saison-filter-dropdown-menu" role="listbox">
                    {DATE_OPTIONS.map((opt) => (
                      <li key={opt}>
                        <button
                          type="button"
                          role="option"
                          aria-selected={filterDate === opt}
                          className="saison-filter-dropdown-item"
                          onClick={() => {
                            setFilterDate(opt)
                            setOpenFilter(null)
                          }}
                        >
                          {opt}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>
          </div>

          <section className="saison-heading">
            <div>
              <p className="saison-title">SAISON 2026</p>
              <p className="saison-subtitle">Aucun parcours ou événement pour le moment</p>
            </div>
            <button
              className="info-card saison-add-parcours-card--hidden"
              type="button"
              onClick={() => {
                setCreateModalView('select')
                setIsCreateModalOpen(true)
              }}
              aria-hidden
            >
              <div>
                <p className="info-card__title">Ajouter un parcours</p>
                <p className="info-card__subtitle">Commencer dès à présent à vous préparez</p>
              </div>
              <span className="info-card__chevron" aria-hidden="true">
                ›
              </span>
            </button>
          </section>

          <section className="saison-courses" aria-label="Parcours auxquels vous participez">
            <div className="courses-carousel">
              {filteredCoursesForList.map((course) => (
                <article
                  key={course.id}
                  className="courses-carousel__card"
                  role="button"
                  tabIndex={0}
                  onClick={() => _onCourseSelect?.(course.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      _onCourseSelect?.(course.id)
                    }
                  }}
                >
                  <div className="courses-carousel__card-gpx">
                    {course.gpxSvg ? (
                      <div className="courses-carousel__card-gpx-svg" dangerouslySetInnerHTML={{ __html: course.gpxSvg }} />
                    ) : (
                      <div className="courses-carousel__card-gpx-placeholder" aria-hidden />
                    )}
                  </div>
                  <div className="courses-carousel__card-content">
                    <p className="courses-carousel__card-title">{course.name}</p>
                    {course.distanceKm != null && course.elevationGain != null && (
                      <p className="courses-carousel__card-stats">{course.distanceKm.toFixed(0)} km · {Math.round(course.elevationGain)} D+</p>
                    )}
                  </div>
                </article>
              ))}
            </div>
          </section>
        </main>
      </div>

      {isCreateModalOpen && (
        <div className="modal-overlay" role="dialog" aria-modal="true">
          {createModalView === 'select' && (
            <div className="modal">
              <header className="modal__header">
                <h2>Ajouter un parcours</h2>
                <button
                  type="button"
                  className="modal__close"
                  onClick={() => setIsCreateModalOpen(false)}
                  aria-label="Fermer"
                >
                  <HiX />
                </button>
              </header>
              <p className="modal__subtitle">Importer votre GPX et commencer à vous préparer.</p>
              <button
                className="modal-card"
                type="button"
                onClick={() => setCreateModalView('course')}
              >
                <div>
                  <p className="modal-card__title">Créer un parcours</p>
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
                  <HiX />
                </button>
              </header>
              <p className="modal__subtitle modal__subtitle--left">
                Un événement vous permet de regrouper plusieurs parcours.
              </p>
              <div className="modal-upload-simple">
                <label className="modal-upload-simple__button" htmlFor="event-image">
                  <span className="modal-upload-simple__icon">+</span>
                  <span className="modal-upload-simple__text">Télécharger une image pour l'événement</span>
                </label>
                <input
                  id="event-image"
                  className="modal-upload-simple__input"
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
                <h2>Crée ton parcours</h2>
                <button
                  type="button"
                  className="modal__close"
                  onClick={() => setIsCreateModalOpen(false)}
                  aria-label="Fermer"
                >
                  <HiX />
                </button>
              </header>
              <p className="modal__subtitle">Un événement vous permet de regrouper plusieurs parcours.</p>
              <div className="modal-upload-simple">
                <label className="modal-upload-simple__button" htmlFor="course-image">
                  <span className="modal-upload-simple__icon">+</span>
                  <span className="modal-upload-simple__text">Télécharger une image pour le parcours</span>
                </label>
                <input
                  id="course-image"
                  className="modal-upload-simple__input"
                  type="file"
                  accept="image/*"
                  ref={courseImageRef}
                />
              </div>
              <div className="modal-upload-simple">
                <label className="modal-upload-simple__button" htmlFor="course-gpx">
                  <span className="modal-upload-simple__icon">+</span>
                  <span className="modal-upload-simple__text">Télécharger un fichier GPX pour le parcours</span>
                </label>
                <input
                  id="course-gpx"
                  className="modal-upload-simple__input"
                  type="file"
                  accept=".gpx,application/gpx+xml,application/xml,text/xml"
                  ref={courseGpxRef}
                />
              </div>
              <div className="modal-field">
                <label htmlFor="course-name">
                  Nom du parcours<span className="modal-field__required">*</span>
                </label>
                <input
                  id="course-name"
                  className="modal-input"
                  type="text"
                  placeholder="UTMB"
                  ref={courseNameRef}
                />
              </div>
              <div className="modal-field modal-field--hidden" aria-hidden="true">
                <label htmlFor="course-strava-route">
                  URL Strava Route (optionnel)
                </label>
                <input
                  id="course-strava-route"
                  className="modal-input"
                  type="url"
                  placeholder="https://www.strava.com/routes/3344025913460591936"
                  ref={courseStravaRouteRef}
                />
                <p style={{ fontSize: '12px', color: '#9ca3af', marginTop: '4px' }}>
                  Les segments critiques seront automatiquement analysés
                </p>
              </div>
              <div className="modal-field">
                <label className="modal-field__checkbox-label">
                  <input
                    ref={coursePublishRef}
                    type="checkbox"
                    className="modal-input"
                  />
                  <span>Publier (visible par tous)</span>
                </label>
                <p className="modal-field__hint">Si coché, votre parcours sera visible par tous les utilisateurs.</p>
              </div>
              <p className="modal-footnote">
                En créant un parcours tu acceptes{' '}
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
