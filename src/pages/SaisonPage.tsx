import { useMemo, useRef, useState } from 'react'
import { HiX } from 'react-icons/hi'

import './SaisonPage.css'

import HeaderTopBar from '../components/HeaderTopBar'
import SideNav from '../components/SideNav'
import { gpxToSvg, extractGpxStartCoordinates, extractGpxWaypoints, getBoundsFromGpx } from '../lib/gpxToSvg'
import { extractRouteIdFromUrl } from '../lib/stravaRouteParser'

type EventWithCourses = {
  id: string
  name: string
  courses: Array<{
    id: string
    name: string
    startCoordinates?: [number, number]
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
  const coursesWithCoordsCount = useMemo(() => {
    return events.flatMap((ev) => ev.courses).filter((c) => c.startCoordinates && c.startCoordinates.length === 2).length
  }, [events])
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [createModalView, setCreateModalView] = useState<CreateModalView>('select')
  const eventNameRef = useRef<HTMLInputElement | null>(null)
  const eventImageRef = useRef<HTMLInputElement | null>(null)
  const courseNameRef = useRef<HTMLInputElement | null>(null)
  const courseImageRef = useRef<HTMLInputElement | null>(null)
  const courseGpxRef = useRef<HTMLInputElement | null>(null)
  const courseStravaRouteRef = useRef<HTMLInputElement | null>(null)

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
    console.log('🚀 Début création course')
    const name = courseNameRef.current?.value?.trim() || 'Sans titre'
    console.log('📝 Nom:', name)
    
    // Vérifier que le nom n'est pas vide ou "Sans titre"
    if (!name || name.toLowerCase() === 'sans titre') {
      console.warn('⚠️ Nom invalide, annulation')
      alert('Veuillez entrer un nom de course valide')
      return
    }

    const imageFile = courseImageRef.current?.files?.[0]
    const gpxFile = courseGpxRef.current?.files?.[0]
    const stravaRouteUrl = courseStravaRouteRef.current?.value?.trim()
    const imageUrl = imageFile ? URL.createObjectURL(imageFile) : undefined
    const gpxName = gpxFile?.name
    console.log('📁 Fichiers:', { image: !!imageFile, gpx: !!gpxFile, stravaUrl: !!stravaRouteUrl })
    
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
        console.log('📊 Traitement GPX...')
        const gpxText = await gpxFile.text()
        const stats = parseGpxStats(gpxText)
        distanceKm = stats.distanceKm
        elevationGain = stats.elevationGain
        profile = stats.profile
        
        // Extraire les coordonnées de départ et les bornes pour la carte
        startCoordinates = extractGpxStartCoordinates(gpxText) || undefined
        gpxBounds = getBoundsFromGpx(gpxText) ?? undefined
        
        // Extraire les waypoints (points d'intérêt)
        const waypoints = extractGpxWaypoints(gpxText)
        
        console.log('📊 Stats GPX:', { 
          distanceKm, 
          elevationGain, 
          profilePoints: profile?.length, 
          startCoordinates,
          waypointsCount: waypoints.length,
          waypoints: waypoints.slice(0, 5).map(w => ({ name: w.name, ele: w.ele, distance: w.extensions?.distance }))
        })
        
        // Conversion GPX → SVG côté client (fonctionne en production)
        const rawSvg = gpxToSvg(gpxText)
        gpxSvg = sanitizeSvg(rawSvg)
        console.log('✅ SVG généré:', !!gpxSvg)
      } catch (error) {
        console.error('❌ Erreur lors de la conversion GPX → SVG', error)
      }
    }

    // Extraire l'ID de route depuis l'URL Strava (optionnel, ne bloque pas la création)
    if (stravaRouteUrl) {
      console.log('🔗 Récupération segments Strava et performances...')
      stravaRouteId = extractRouteIdFromUrl(stravaRouteUrl) || undefined
      if (stravaRouteId) {
        console.log('🔗 Route ID extrait:', stravaRouteId)
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
              console.log(`✅ Segments récupérés : ${stravaSegments?.length || 0}`)
              
              // 2. Récupérer les performances du coureur sur cette route (pour améliorer l'analyse)
              try {
                const performanceResponse = await fetch(`/api/strava/route-performance?route_id=${stravaRouteId}`, {
                  headers: {
                    Authorization: `Bearer ${token.access_token}`,
                  },
                })
                
                if (performanceResponse.ok) {
                  const performanceData = await performanceResponse.json()
                  console.log(`📊 Performances récupérées : ${performanceData.activities_count} activités, ${performanceData.segment_performance?.length || 0} segments avec données`)
                  
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
                    console.log(`✅ Segments enrichis avec performances`)
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
      ...(startCoordinates && { startCoordinates }),
      ...(gpxBounds && { gpxBounds }),
      ...(stravaRouteId && { stravaRouteId }),
      ...(stravaSegments && stravaSegments.length > 0 && { stravaSegments }),
    }
    
    console.log('💾 Données course à créer:', {
      name,
      hasImage: !!imageUrl,
      hasGpx: !!gpxSvg,
      hasStravaRoute: !!stravaRouteId,
      hasSegments: !!stravaSegments,
    })

    // Fermer la modale et naviguer
    setIsCreateModalOpen(false)
    setCreateModalView('select')
    onNavigate?.('courses')

    // Appeler la fonction de création (asynchrone)
    try {
      console.log('📤 Appel onCreateCourse...')
      await onCreateCourse?.(courseData)
      console.log('✅ onCreateCourse terminé')
    } catch (error) {
      console.error('❌ Erreur lors de l\'appel onCreateCourse:', error)
      alert('Erreur lors de la création de la course. Vérifiez la console pour plus de détails.')
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
            <section className="courses-section">
              <div className="courses-heading">
                <p className="courses-title">Mes courses en cours</p>
                <p className="courses-subtitle">
                  {coursesWithCoordsCount > 0
                    ? `${coursesWithCoordsCount} course(s) affichée(s) sur le globe`
                    : "Vous n'avez pas encore de course en cours."}
                </p>
              </div>
              <div className="courses-carousel">
                {/* Les courses seront affichées ici une fois créées */}
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
                  <HiX />
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
                  <HiX />
                </button>
              </header>
              <p className="modal__subtitle modal__subtitle--left">
                Un événement vous permet de regrouper plusieurs course.
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
                <h2>Crée ta course</h2>
                <button
                  type="button"
                  className="modal__close"
                  onClick={() => setIsCreateModalOpen(false)}
                  aria-label="Fermer"
                >
                  <HiX />
                </button>
              </header>
              <p className="modal__subtitle">Un événement vous permet de regrouper plusieurs course.</p>
              <div className="modal-upload-simple">
                <label className="modal-upload-simple__button" htmlFor="course-image">
                  <span className="modal-upload-simple__icon">+</span>
                  <span className="modal-upload-simple__text">Télécharger une image pour la course</span>
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
                  <span className="modal-upload-simple__text">Télécharger un fichier GPX pour la course</span>
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
