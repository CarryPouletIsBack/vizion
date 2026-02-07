import './CoursesPage.css'

import { useEffect, useRef, useState } from 'react'
import { HiX } from 'react-icons/hi'

import gpxIcon from '../assets/d824ad10b22406bc6f779da5180da5cdaeca1e2c.svg'
import grandRaidLogo from '../assets/da2a1ce5e69564e56a29b5912fd151a8f515e136.png'
import HeaderTopBar from '../components/HeaderTopBar'
import SideNav from '../components/SideNav'
import Skeleton from '../components/Skeleton'
import useStravaMetrics from '../hooks/useStravaMetrics'
import { gpxToSvg, extractGpxStartCoordinates, extractGpxWaypoints } from '../lib/gpxToSvg'
import { extractRouteIdFromUrl } from '../lib/stravaRouteParser'
import { supabase } from '../lib/supabase'

type CoursesPageProps = {
  onNavigate?: (view: 'saison' | 'events' | 'courses' | 'course' | 'account') => void
  onSelectCourse?: (courseId: string) => void
  events: Array<{
    id: string
    name: string
    country: string
    startLabel: string
    imageUrl?: string
    courses: Array<{
      id: string
      name: string
      imageUrl?: string
      gpxName?: string
      gpxSvg?: string
      distanceKm?: number
      elevationGain?: number
      profile?: Array<[number, number]>
    }>
  }>
  selectedEventId: string | null
  onCreateCourse?: (payload: {
    name: string
    imageUrl?: string
    gpxName?: string
    gpxSvg?: string
    distanceKm?: number
    elevationGain?: number
    profile?: Array<[number, number]>
    startCoordinates?: [number, number]
    stravaRouteId?: string
    stravaSegments?: Array<{
      id: number
      name: string
      distance: number
      elevation_gain: number
      average_grade: number
      type: 'climb' | 'descent' | 'flat'
    }>
  }) => void
}

/**
 * Calcule le taux de progression (niveau actuel vs exigences de la course)
 * Retourne un pourcentage entre 0 et 100
 * 
 * Logique stricte : seuils minimums réalistes pour une course de 175 km / 10150 D+
 */
function calculateReadinessPercentage(
  metrics: { kmPerWeek: number; dPlusPerWeek: number; longRunDistanceKm: number; longRunDPlus: number; regularity: 'bonne' | 'moyenne' | 'faible' } | null,
  courseDistanceKm: number,
  courseElevationGain: number
): number {
  if (!metrics) {
    return 0 // Pas de données = 0%
  }

  const courseWeeklyEquivalent = courseDistanceKm / 6
  const courseWeeklyDPlus = courseElevationGain / 6
  
  // Seuils minimums stricts
  const minDistanceWeekly = 40 // km/semaine minimum
  const idealDistanceWeekly = courseWeeklyEquivalent * 0.7 // Objectif réaliste
  let distanceCoverage = 0
  if (metrics.kmPerWeek >= idealDistanceWeekly) {
    distanceCoverage = 1.0
  } else if (metrics.kmPerWeek >= minDistanceWeekly) {
    distanceCoverage = 0.5 + (metrics.kmPerWeek - minDistanceWeekly) / (idealDistanceWeekly - minDistanceWeekly) * 0.5
  } else {
    distanceCoverage = Math.max(0, (metrics.kmPerWeek / minDistanceWeekly) * 0.5)
  }

  const minDPlusWeekly = 1500 // m/semaine minimum
  const idealDPlusWeekly = courseWeeklyDPlus * 0.7
  let elevationCoverage = 0
  if (metrics.dPlusPerWeek >= idealDPlusWeekly) {
    elevationCoverage = 1.0
  } else if (metrics.dPlusPerWeek >= minDPlusWeekly) {
    elevationCoverage = 0.5 + (metrics.dPlusPerWeek - minDPlusWeekly) / (idealDPlusWeekly - minDPlusWeekly) * 0.5
  } else {
    elevationCoverage = Math.max(0, (metrics.dPlusPerWeek / minDPlusWeekly) * 0.5)
  }
  
  // Score de régularité (strict)
  const regularityScore = metrics.regularity === 'bonne' ? 1.0 : metrics.regularity === 'moyenne' ? 0.5 : 0.2

  // Score de sortie longue
  const longRunThreshold = Math.max(courseDistanceKm * 0.4, 70)
  const idealLongRun = courseDistanceKm * 0.6
  let longRunScore = 0
  if (metrics.longRunDistanceKm >= idealLongRun) {
    longRunScore = 1.0
  } else if (metrics.longRunDistanceKm >= longRunThreshold) {
    longRunScore = 0.5 + (metrics.longRunDistanceKm - longRunThreshold) / (idealLongRun - longRunThreshold) * 0.5
  } else {
    longRunScore = Math.max(0, (metrics.longRunDistanceKm / longRunThreshold) * 0.5)
  }

  // Score de D+ max
  const dPlusThreshold = Math.max(courseElevationGain * 0.5, 6000)
  const idealDPlusMax = courseElevationGain * 0.7
  let dPlusMaxScore = 0
  if (metrics.longRunDPlus >= idealDPlusMax) {
    dPlusMaxScore = 1.0
  } else if (metrics.longRunDPlus >= dPlusThreshold) {
    dPlusMaxScore = 0.5 + (metrics.longRunDPlus - dPlusThreshold) / (idealDPlusMax - dPlusThreshold) * 0.5
  } else {
    dPlusMaxScore = Math.max(0, (metrics.longRunDPlus / dPlusThreshold) * 0.5)
  }

  // Calculer le pourcentage global (pondération stricte)
  // Distance: 30%, D+: 30%, Sortie longue: 25%, D+ max: 10%, Régularité: 5%
  const coverageRatio = Math.round(
    (distanceCoverage * 0.30 +
      elevationCoverage * 0.30 +
      longRunScore * 0.25 +
      dPlusMaxScore * 0.10 +
      regularityScore * 0.05) *
      100
  )

  return Math.min(100, Math.max(0, coverageRatio))
}

export default function CoursesPage({
  onNavigate,
  onSelectCourse,
  events,
  selectedEventId,
  onCreateCourse,
}: CoursesPageProps) {
  const { metrics, loading } = useStravaMetrics()
  const selectedEvent = events.find((event) => event.id === selectedEventId) ?? events[0]
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [directCourses, setDirectCourses] = useState<Array<{
    id: string
    name: string
    imageUrl?: string
    gpxName?: string
    gpxSvg?: string
    distanceKm?: number
    elevationGain?: number
    profile?: Array<[number, number]>
  }>>([])
  
  // Charger les courses directement depuis Supabase si elles ne sont pas dans les events (fallback pour RLS)
  useEffect(() => {
    const loadCoursesDirectly = async () => {
      try {
        const { data: coursesData, error } = await supabase
          .from('courses')
          .select('*')
          .order('created_at', { ascending: false })

        if (error) {
          if (import.meta.env.DEV) {
            console.warn('[CoursesPage] Supabase indisponible (dev), utilisation des courses en cache.')
          } else {
            console.warn('[CoursesPage] Erreur lors du chargement direct des courses:', error.message)
          }
          return
        }

        if (coursesData && coursesData.length > 0) {
          const formattedCourses = coursesData.map((course: any) => {
            let profile: Array<[number, number]> | undefined = undefined
            if (course.profile) {
              if (typeof course.profile === 'string') {
                try {
                  // Le profile peut être une string JSON double-encodée
                  const parsed = JSON.parse(course.profile)
                  if (typeof parsed === 'string') {
                    profile = JSON.parse(parsed)
                  } else {
                    profile = parsed
                  }
                } catch {
                  profile = undefined
                }
              } else if (Array.isArray(course.profile)) {
                profile = course.profile
              }
            }

            return {
              id: course.id,
              name: course.name,
              imageUrl: course.image_url || undefined,
              gpxName: course.gpx_name || undefined,
              gpxSvg: course.gpx_svg || undefined,
              distanceKm: course.distance_km || undefined,
              elevationGain: course.elevation_gain || undefined,
              profile,
            }
          })
          setDirectCourses(formattedCourses)
        }
      } catch (err) {
        if (!import.meta.env.DEV) console.error('[CoursesPage] Erreur chargement direct:', err)
      }
    }

    const totalCoursesInEvents = events.reduce((sum, event) => sum + (event.courses?.length || 0), 0)
    if (totalCoursesInEvents === 0) {
      loadCoursesDirectly()
    } else {
      loadCoursesDirectly()
    }
  }, [events])
  const courseNameRef = useRef<HTMLInputElement | null>(null)
  const courseImageRef = useRef<HTMLInputElement | null>(null)
  const courseGpxRef = useRef<HTMLInputElement | null>(null)
  const courseStravaRouteRef = useRef<HTMLInputElement | null>(null)

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
        pathLike.setAttribute('stroke', '#b2aaaa')
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
        if (i % 10 === 0 && curr.ele !== undefined) {
          profile.push([Number(distanceKm.toFixed(2)), Math.round(curr.ele)])
        }
      }
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

    let startCoordinates: [number, number] | undefined
    if (gpxFile) {
      try {
        console.log('📊 Traitement GPX...')
        const gpxText = await gpxFile.text()
        const stats = parseGpxStats(gpxText)
        distanceKm = stats.distanceKm
        elevationGain = stats.elevationGain
        profile = stats.profile
        
        startCoordinates = extractGpxStartCoordinates(gpxText) || undefined
        
        const waypoints = extractGpxWaypoints(gpxText)
        
        console.log('📊 Stats GPX:', { 
          distanceKm, 
          elevationGain, 
          profilePoints: profile?.length, 
          startCoordinates,
          waypointsCount: waypoints.length,
        })
        
        const rawSvg = gpxToSvg(gpxText)
        gpxSvg = sanitizeSvg(rawSvg)
        console.log('✅ SVG généré:', !!gpxSvg)
      } catch (error) {
        console.error('❌ Erreur lors de la conversion GPX → SVG', error)
      }
    }

    if (stravaRouteUrl) {
      console.log('🔗 Récupération segments Strava et performances...')
      stravaRouteId = extractRouteIdFromUrl(stravaRouteUrl) || undefined
      if (stravaRouteId) {
        console.log('🔗 Route ID extrait:', stravaRouteId)
        try {
          const tokenData = localStorage.getItem('trackali:strava_token')
          if (tokenData) {
            const token = JSON.parse(tokenData)
            
            const segmentsResponse = await fetch(`/api/strava/route-segments?route_id=${stravaRouteId}`, {
              headers: {
                Authorization: `Bearer ${token.access_token}`,
              },
            })

            if (segmentsResponse.ok) {
              const segmentsData = await segmentsResponse.json()
              stravaSegments = segmentsData.segments || undefined
              console.log(`✅ Segments récupérés : ${stravaSegments?.length || 0}`)
            } else {
              const errorText = await segmentsResponse.text()
              console.warn('⚠️ Impossible de récupérer les segments Strava:', errorText)
            }
          } else {
            console.warn('⚠️ Pas de token Strava, segments non récupérés')
          }
        } catch (error) {
          console.error('❌ Erreur lors de la récupération des segments Strava:', error)
        }
      } else {
        console.warn('⚠️ Impossible d\'extraire l\'ID de route depuis l\'URL')
      }
    }

    const courseData = {
      name,
      imageUrl,
      gpxName,
      gpxSvg,
      distanceKm,
      elevationGain,
      profile,
      ...(startCoordinates && { startCoordinates }),
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

    setIsCreateModalOpen(false)

    try {
      console.log('📤 Appel onCreateCourse...')
      await onCreateCourse?.(courseData)
      console.log('✅ onCreateCourse terminé')
    } catch (error) {
      console.error('❌ Erreur lors de l\'appel onCreateCourse:', error)
      alert('Erreur lors de la création de la course. Vérifiez la console pour plus de détails.')
    }

    if (courseNameRef.current) courseNameRef.current.value = ''
    if (courseImageRef.current) courseImageRef.current.value = ''
    if (courseGpxRef.current) courseGpxRef.current.value = ''
    if (courseStravaRouteRef.current) courseStravaRouteRef.current.value = ''
  }
  // Afficher toutes les courses de tous les events si selectedEvent n'a pas de courses
  // Utiliser les courses directes comme fallback si aucune course n'est disponible dans les events
  const allCoursesFromEvents = selectedEvent?.courses && selectedEvent.courses.length > 0
    ? selectedEvent.courses
    : events.flatMap(event => event.courses || [])
  
  // Utiliser les courses directes si aucune course n'est disponible dans les events
  // Priorité : courses des events > courses directes
  const allCourses = allCoursesFromEvents.length > 0 ? allCoursesFromEvents : directCourses
  
  const courseCards =
    allCourses
      .filter((course) => course.name.trim().toLowerCase() !== 'sans titre')
      .map((course, index) => {
        // Utiliser les vraies valeurs de la course, ou 0 si non définies (pas de valeurs par défaut)
        const courseDistanceKm = course.distanceKm ?? 0
        const courseElevationGain = course.elevationGain ?? 0
        
        // Si la course n'a pas de distance/D+ définis, ne pas calculer le pourcentage
        const readinessPercentage = (courseDistanceKm > 0 && courseElevationGain > 0)
          ? calculateReadinessPercentage(metrics, courseDistanceKm, courseElevationGain)
          : 0
        
        // Trouver l'event parent de la course
        // Si la course vient de directCourses, chercher l'event par event_id depuis Supabase
        const parentEvent = events.find(e => e.courses?.some(c => c.id === course.id)) || selectedEvent || events[0]
        
        return {
          id: course.id,
          title: parentEvent?.name || 'Course',
          year: '2026',
          subtitle: course.name,
          stats:
            course.distanceKm && course.elevationGain
              ? `${course.distanceKm.toFixed(0)} km – ${Math.round(course.elevationGain)} D+`
              : course.distanceKm
                ? `${course.distanceKm.toFixed(0)} km`
                : 'Course',
          readiness: readinessPercentage > 0 ? `${readinessPercentage}%` : '-',
          countdown: '6 mois',
          imageUrl: course.imageUrl ?? parentEvent?.imageUrl ?? grandRaidLogo,
          gpxName: course.gpxName,
          gpxSvg: course.gpxSvg,
          isFirst: index === 0,
        }
      }) ?? []
  return (
    <div className="courses-page">
      <HeaderTopBar onNavigate={onNavigate} />

      <div className="courses-body">
        <aside className="courses-side">
          <SideNav activeItem="courses" onNavigate={onNavigate} />
        </aside>

        <main className="courses-main">
          <section className="courses-header">
            <div>
              <p className="courses-header__title">COURSE</p>
              <p className="courses-header__subtitle">
                {selectedEvent ? `${selectedEvent.courses.length} courses` : '0 course'}
              </p>
            </div>
            {onCreateCourse && (
              <button
                className="info-card"
                type="button"
                onClick={() => setIsCreateModalOpen(true)}
              >
                <div>
                  <p className="info-card__title">Ajouter une course</p>
                  <p className="info-card__subtitle">Importer votre GPX et commencer à vous préparer</p>
                </div>
                <span className="info-card__chevron" aria-hidden="true">
                  ›
                </span>
              </button>
            )}
          </section>

          <section className="courses-grid">
            {courseCards.map((card) => (
              <article
                key={card.id}
                className="course-card"
                role="button"
                tabIndex={0}
                onClick={() => onSelectCourse?.(card.id)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    onSelectCourse?.(card.id)
                  }
                }}
              >
                <div className="course-card__top">
                  <div className="course-card__gpx">
                    {card.gpxSvg ? (
                      <div
                        className="course-card__gpx-svg"
                        dangerouslySetInnerHTML={{ __html: card.gpxSvg }}
                      />
                    ) : (
                      <img src={gpxIcon} alt="GPX" />
                    )}
                  </div>
                  <div className="course-card__content">
                    <h3 className="course-card__title">{card.subtitle}</h3>
                    <p className="course-card__stats">{card.stats}</p>
                  </div>
                </div>
                <footer className="course-card__footer">
                  <div className="course-card__footer-left">
                    {loading ? (
                      <div className="course-card__footer-prep">
                        État de préparation : <Skeleton width="40px" height="16px" className="skeleton-inline" />
                      </div>
                    ) : (
                      <p className="course-card__footer-prep">
                        État de préparation : <strong>{card.readiness}</strong>
                      </p>
                    )}
                  </div>
                  <div className="course-card__footer-right">
                    <p>Début de la course</p>
                    <p className="course-card__countdown">{card.countdown}</p>
                  </div>
                </footer>
              </article>
            ))}
          </section>
        </main>
      </div>

      {isCreateModalOpen && (
        <div className="modal-overlay" role="dialog" aria-modal="true">
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
              <label className="modal-upload-simple__button" htmlFor="course-image-page">
                <span className="modal-upload-simple__icon">+</span>
                <span className="modal-upload-simple__text">Télécharger une image pour la course</span>
              </label>
              <input
                id="course-image-page"
                className="modal-upload-simple__input"
                type="file"
                accept="image/*"
                ref={courseImageRef}
              />
            </div>
            <div className="modal-upload-simple">
              <label className="modal-upload-simple__button" htmlFor="course-gpx-page">
                <span className="modal-upload-simple__icon">+</span>
                <span className="modal-upload-simple__text">Télécharger un fichier GPX pour la course</span>
              </label>
              <input
                id="course-gpx-page"
                className="modal-upload-simple__input"
                type="file"
                accept=".gpx,application/gpx+xml,application/xml,text/xml"
                ref={courseGpxRef}
              />
            </div>
            <div className="modal-field">
              <label htmlFor="course-name-page">
                Nom de la course<span className="modal-field__required">*</span>
              </label>
              <input
                id="course-name-page"
                className="modal-input"
                type="text"
                placeholder="UTMB"
                ref={courseNameRef}
              />
            </div>
            <div className="modal-field modal-field--hidden" aria-hidden="true">
              <label htmlFor="course-strava-route-page">
                URL Strava Route (optionnel)
              </label>
              <input
                id="course-strava-route-page"
                className="modal-input"
                type="url"
                placeholder="https://www.strava.com/routes/3344025913460591936"
                ref={courseStravaRouteRef}
              />
              <p className="modal-field__hint">
                Les segments critiques seront automatiquement analysés
              </p>
            </div>
            <p className="modal-footnote">
              En créant une course tu accepte{' '}
              <span className="modal-footnote__link">la charte d'utilisation de communauté.</span>
            </p>
            <div className="modal-actions">
              <button className="modal-back" type="button" onClick={() => setIsCreateModalOpen(false)}>
                Retour
              </button>
              <button className="modal-primary" type="button" onClick={handleCreateCourse}>
                Créer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
