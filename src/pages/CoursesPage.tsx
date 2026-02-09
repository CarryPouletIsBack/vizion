import './CoursesPage.css'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { HiX } from 'react-icons/hi'
import { FiMoreVertical, FiEdit3, FiTrash2, FiStar } from 'react-icons/fi'

import gpxIcon from '../assets/d824ad10b22406bc6f779da5180da5cdaeca1e2c.svg'
import grandRaidLogo from '../assets/da2a1ce5e69564e56a29b5912fd151a8f515e136.png'
import HeaderTopBar from '../components/HeaderTopBar'
import SideNav from '../components/SideNav'
import Skeleton from '../components/Skeleton'
import useStravaMetrics from '../hooks/useStravaMetrics'
import { gpxToSvg, extractGpxStartCoordinates, extractGpxWaypoints, getBoundsFromGpx } from '../lib/gpxToSvg'
import { extractRouteIdFromUrl } from '../lib/stravaRouteParser'
import { formatCountdownLabel } from '../lib/dateUtils'
import { getWeather, formatWeatherCircuitMessage } from '../lib/xweather'
import { getCurrentUser } from '../lib/auth'
import { getMySelectedCourseIds } from '../lib/userCourseSelections'
import { supabase } from '../lib/supabase'

/** Affiche le message météo circuit (pluie actuelle, 24h, boue) pour une position. */
function CourseCardWeather({ lat, lon }: { lat: number; lon: number }) {
  const [weather, setWeather] = useState<Awaited<ReturnType<typeof getWeather>> | undefined>(undefined)
  useEffect(() => {
    let cancelled = false
    getWeather(lat, lon).then((w) => {
      if (!cancelled) setWeather(w ?? null)
    })
    return () => { cancelled = true }
  }, [lat, lon])
  if (weather === undefined) return null
  return (
    <p className="course-card__weather" aria-label="Météo du circuit">
      {formatWeatherCircuitMessage(weather)}
    </p>
  )
}

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
      date?: string
      startTime?: string
      startCoordinates?: [number, number]
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
    date?: string
    startTime?: string
    isPublished?: boolean
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
  onUpdateCourse?: (
    courseId: string,
    payload: {
      name: string
      imageUrl?: string
      gpxName?: string
      gpxSvg?: string
      distanceKm?: number
      elevationGain?: number
      profile?: Array<[number, number]>
      startCoordinates?: [number, number]
      date?: string | null
      startTime?: string | null
    }
  ) => void
  onDeleteCourse?: (courseId: string) => void
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

const FAVORITES_KEY = 'trackali:course_favorites'

export default function CoursesPage({
  onNavigate,
  onSelectCourse,
  events,
  selectedEventId,
  onCreateCourse,
  onUpdateCourse,
  onDeleteCourse,
}: CoursesPageProps) {
  const { metrics, loading } = useStravaMetrics()
  const selectedEvent = events.find((event) => event.id === selectedEventId) ?? events[0]
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [courseOptionsOpenId, setCourseOptionsOpenId] = useState<string | null>(null)
  const [editingCourse, setEditingCourse] = useState<{
    id: string
    name: string
    imageUrl?: string
    gpxName?: string
    gpxSvg?: string
    distanceKm?: number
    elevationGain?: number
    profile?: Array<[number, number]>
    date?: string
    startTime?: string
    startCoordinates?: [number, number]
  } | null>(null)
  const [favorites, setFavorites] = useState<Set<string>>(() => {
    try {
      const raw = localStorage.getItem(FAVORITES_KEY)
      if (!raw) return new Set()
      const arr = JSON.parse(raw) as string[]
      return new Set(Array.isArray(arr) ? arr : [])
    } catch {
      return new Set()
    }
  })
  const [directCourses, setDirectCourses] = useState<Array<{
    id: string
    name: string
    imageUrl?: string
    gpxName?: string
    gpxSvg?: string
    distanceKm?: number
    elevationGain?: number
    profile?: Array<[number, number]>
    date?: string
    startTime?: string
    startCoordinates?: [number, number]
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

            const startCoords = course.start_coordinates && Array.isArray(course.start_coordinates) && course.start_coordinates.length === 2
              ? [course.start_coordinates[0], course.start_coordinates[1]] as [number, number]
              : undefined
            return {
              id: course.id,
              name: course.name,
              imageUrl: course.image_url || undefined,
              gpxName: course.gpx_name || undefined,
              gpxSvg: course.gpx_svg || undefined,
              distanceKm: course.distance_km || undefined,
              elevationGain: course.elevation_gain || undefined,
              profile,
              date: course.date ?? undefined,
              startTime: course.start_time ?? undefined,
              startCoordinates: startCoords,
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

  useEffect(() => {
    if (courseOptionsOpenId == null) return
    const close = (e: MouseEvent) => {
      const target = e.target as Node
      const wraps = document.querySelectorAll('.course-card__options-wrap')
      const clickedInsideAnyOptions = Array.from(wraps).some((wrap) => wrap.contains(target))
      if (!clickedInsideAnyOptions) setCourseOptionsOpenId(null)
    }
    document.addEventListener('click', close, { capture: true })
    return () => document.removeEventListener('click', close, { capture: true })
  }, [courseOptionsOpenId])

  const courseNameRef = useRef<HTMLInputElement | null>(null)
  const courseImageRef = useRef<HTMLInputElement | null>(null)
  const courseGpxRef = useRef<HTMLInputElement | null>(null)
  const courseStravaRouteRef = useRef<HTMLInputElement | null>(null)
  const courseDateRef = useRef<HTMLInputElement | null>(null)
  const courseTimeRef = useRef<HTMLInputElement | null>(null)
  const coursePublishRef = useRef<HTMLInputElement | null>(null)

  const editNameRef = useRef<HTMLInputElement | null>(null)
  const editDateRef = useRef<HTMLInputElement | null>(null)
  const editTimeRef = useRef<HTMLInputElement | null>(null)
  const editImageRef = useRef<HTMLInputElement | null>(null)
  const editGpxRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    if (!editingCourse) return
    if (editNameRef.current) editNameRef.current.value = editingCourse.name
    if (editDateRef.current) editDateRef.current.value = editingCourse.date ?? ''
    if (editTimeRef.current) editTimeRef.current.value = editingCourse.startTime ?? '08:00'
    if (editImageRef.current) editImageRef.current.value = ''
    if (editGpxRef.current) editGpxRef.current.value = ''
  }, [editingCourse])

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
      alert('Veuillez entrer un nom de parcours valide')
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
    let gpxBounds: { minLat: number; maxLat: number; minLon: number; maxLon: number } | undefined
    if (gpxFile) {
      try {
        console.log('📊 Traitement GPX...')
        const gpxText = await gpxFile.text()
        const stats = parseGpxStats(gpxText)
        distanceKm = stats.distanceKm
        elevationGain = stats.elevationGain
        profile = stats.profile
        
        startCoordinates = extractGpxStartCoordinates(gpxText) || undefined
        gpxBounds = getBoundsFromGpx(gpxText) ?? undefined
        
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

    const dateVal = courseDateRef.current?.value?.trim()
    const timeVal = courseTimeRef.current?.value?.trim()
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
      ...(dateVal && { date: dateVal }),
      ...(timeVal && { startTime: timeVal }),
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
      alert('Erreur lors de la création du parcours. Vérifiez la console pour plus de détails.')
    }

    if (courseNameRef.current) courseNameRef.current.value = ''
    if (courseImageRef.current) courseImageRef.current.value = ''
    if (courseGpxRef.current) courseGpxRef.current.value = ''
    if (courseStravaRouteRef.current) courseStravaRouteRef.current.value = ''
    if (courseDateRef.current) courseDateRef.current.value = ''
    if (courseTimeRef.current) courseTimeRef.current.value = '08:00'
  }

  const handleEditCourse = async () => {
    if (!editingCourse || !onUpdateCourse) return
    const name = editNameRef.current?.value?.trim() || editingCourse.name
    if (!name || name.toLowerCase() === 'sans titre') {
      alert('Veuillez entrer un nom de parcours valide')
      return
    }
    const dateVal = (editDateRef.current?.value ?? '').trim()
    const timeVal = (editTimeRef.current?.value ?? '').trim()
    let imageUrl: string | undefined = editingCourse.imageUrl
    const imageFile = editImageRef.current?.files?.[0]
    if (imageFile) imageUrl = URL.createObjectURL(imageFile)
    let gpxName = editingCourse.gpxName
    let gpxSvg = editingCourse.gpxSvg
    let distanceKm = editingCourse.distanceKm
    let elevationGain = editingCourse.elevationGain
    let profile = editingCourse.profile
    let startCoordinates: [number, number] | undefined
    const gpxFile = editGpxRef.current?.files?.[0]
    if (gpxFile) {
      const gpxText = await gpxFile.text()
      const stats = parseGpxStats(gpxText)
      distanceKm = stats.distanceKm
      elevationGain = stats.elevationGain
      profile = stats.profile
      startCoordinates = extractGpxStartCoordinates(gpxText) ?? undefined
      const svgResult = gpxToSvg(gpxText)
      gpxSvg = svgResult ? sanitizeSvg(svgResult) : undefined
      gpxName = gpxFile.name
    }
    const payload = {
      name,
      ...(imageUrl && { imageUrl }),
      ...(gpxName && { gpxName }),
      ...(gpxSvg && { gpxSvg }),
      ...(distanceKm != null && { distanceKm }),
      ...(elevationGain != null && { elevationGain }),
      ...(profile && profile.length > 0 && { profile }),
      ...(startCoordinates && { startCoordinates }),
      date: dateVal || null,
      startTime: timeVal || null,
    }
    setEditingCourse(null)
    try {
      await onUpdateCourse(editingCourse.id, payload)
    } catch (err) {
      console.error('Erreur lors de la mise à jour de la course:', err)
      alert('Erreur lors de la mise à jour du parcours')
      setEditingCourse(editingCourse)
    }
  }

  // Afficher toutes les courses de tous les events si selectedEvent n'a pas de courses
  // Utiliser les courses directes comme fallback si aucune course n'est disponible dans les events
  const allCoursesFromEvents = selectedEvent?.courses && selectedEvent.courses.length > 0
    ? selectedEvent.courses
    : events.flatMap(event => event.courses || [])
  
  // Utiliser les courses directes si aucune course n'est disponible dans les events
  // Priorité : courses des events > courses directes
  const allCourses = allCoursesFromEvents.length > 0 ? allCoursesFromEvents : directCourses

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

  const isMyParcours = useCallback((course: { id: string; createdByUserId?: string | null }) => {
    const createdBy = course.createdByUserId
    return createdBy === currentUserId || mySelectedCourseIds.has(course.id)
  }, [currentUserId, mySelectedCourseIds])

  const catalogCourses = useMemo(() => allCourses.filter((c) => !isMyParcours(c as { id: string; createdByUserId?: string | null })), [allCourses, isMyParcours])
  const myParcoursCourses = useMemo(() => allCourses.filter((c) => isMyParcours(c as { id: string; createdByUserId?: string | null })), [allCourses, isMyParcours])
  
  const courseCards =
    catalogCourses
      .filter((course) => course.name.trim().toLowerCase() !== 'sans titre')
      .map((course, index) => {
        // Utiliser les vraies valeurs de la course, ou 0 si non définies (pas de valeurs par défaut)
        const courseDistanceKm = course.distanceKm ?? 0
        const courseElevationGain = course.elevationGain ?? 0
        
        // Si la course n'a pas de distance/D+ définis, ne pas calculer le pourcentage
        const readinessPercentage = (courseDistanceKm > 0 && courseElevationGain > 0)
          ? calculateReadinessPercentage(metrics, courseDistanceKm, courseElevationGain)
          : 0
        const hasCourseStats = courseDistanceKm > 0 && courseElevationGain > 0
        const readinessLabel =
          hasCourseStats && metrics != null
            ? `${readinessPercentage}%`
            : hasCourseStats && !metrics
              ? 'Connecte Strava'
              : '—'

        // Countdown dynamique à partir de la date (et heure) de la course
        const countdownLabel = formatCountdownLabel(course.date, course.startTime)

        // Trouver l'event parent de la course
        const parentEvent = events.find(e => e.courses?.some(c => c.id === course.id)) || selectedEvent || events[0]

        return {
          id: course.id,
          title: parentEvent?.name || 'Parcours',
          year: '2026',
          subtitle: course.name,
          stats:
            course.distanceKm && course.elevationGain
              ? `${course.distanceKm.toFixed(0)} km – ${Math.round(course.elevationGain)} D+`
              : course.distanceKm
                ? `${course.distanceKm.toFixed(0)} km`
                : 'Parcours',
          readiness: readinessLabel,
          countdown: countdownLabel,
          imageUrl: course.imageUrl ?? parentEvent?.imageUrl ?? grandRaidLogo,
          gpxName: course.gpxName,
          gpxSvg: course.gpxSvg,
          isFirst: index === 0,
          courseRaw: course,
        }
      }) ?? []

  const myParcoursCards = myParcoursCourses
    .filter((course) => course.name.trim().toLowerCase() !== 'sans titre')
    .map((course) => {
      const courseDistanceKm = course.distanceKm ?? 0
      const courseElevationGain = course.elevationGain ?? 0
      const readinessPercentage = (courseDistanceKm > 0 && courseElevationGain > 0)
        ? calculateReadinessPercentage(metrics, courseDistanceKm, courseElevationGain)
        : 0
      const hasCourseStats = courseDistanceKm > 0 && courseElevationGain > 0
      const readinessLabel =
        hasCourseStats && metrics != null
          ? `${readinessPercentage}%`
          : hasCourseStats && !metrics
            ? 'Connecte Strava'
            : '—'
      const countdownLabel = formatCountdownLabel(course.date, course.startTime)
      const parentEvent = events.find(e => e.courses?.some(c => c.id === course.id)) || selectedEvent || events[0]
      return {
        id: course.id,
        title: parentEvent?.name || 'Parcours',
        subtitle: course.name,
        stats: course.distanceKm && course.elevationGain
          ? `${course.distanceKm.toFixed(0)} km – ${Math.round(course.elevationGain)} D+`
          : course.distanceKm ? `${course.distanceKm.toFixed(0)} km` : 'Parcours',
        readiness: readinessLabel,
        countdown: countdownLabel,
        imageUrl: course.imageUrl ?? parentEvent?.imageUrl ?? grandRaidLogo,
        gpxSvg: course.gpxSvg,
        courseRaw: course,
      }
    })

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
              <p className="courses-header__title">PARCOURS</p>
              <p className="courses-header__subtitle">
                {selectedEvent
                  ? `${selectedEvent.courses.length} parcours disponible${selectedEvent.courses.length > 1 ? 's' : ''}`
                  : '0 parcours disponibles'}
              </p>
            </div>
            {onCreateCourse && (
              <button
                className="info-card"
                type="button"
                onClick={() => setIsCreateModalOpen(true)}
              >
                <div>
                  <p className="info-card__title">Ajouter votre parcours</p>
                  <p className="info-card__subtitle">Importer votre GPX et commencer à vous préparer</p>
                </div>
                <span className="info-card__chevron" aria-hidden="true">
                  ›
                </span>
              </button>
            )}
          </section>

          <section className="courses-catalog">
            <h2 className="courses-catalog__title">Parcours de la communauté</h2>
            <div className="courses-grid">
            {courseCards.map((card) => (
              <article
                key={card.id}
                className="course-card"
                role="button"
                tabIndex={0}
                onClick={() => courseOptionsOpenId !== card.id && onSelectCourse?.(card.id)}
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
                  <div className="course-card__options-wrap">
                    <button
                      type="button"
                      className="course-card__options-btn"
                      onClick={(e) => {
                        e.stopPropagation()
                        setCourseOptionsOpenId((id) => (id === card.id ? null : card.id))
                      }}
                      aria-label="Options"
                      aria-expanded={courseOptionsOpenId === card.id}
                      aria-haspopup="true"
                    >
                      <FiMoreVertical aria-hidden />
                    </button>
                    {courseOptionsOpenId === card.id && (
                      <div
                        className="course-card__options-dropdown"
                        role="menu"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          type="button"
                          className="course-card__options-item"
                          role="menuitem"
                          onClick={() => {
                            setCourseOptionsOpenId(null)
                            if (onUpdateCourse) {
                              setEditingCourse(card.courseRaw)
                            } else {
                              onSelectCourse?.(card.id)
                            }
                          }}
                        >
                          <FiEdit3 /> Modifier
                        </button>
                        {onDeleteCourse && (
                          <button
                            type="button"
                            className="course-card__options-item course-card__options-item--danger"
                            role="menuitem"
                            onClick={() => {
                              if (window.confirm('Supprimer ce parcours ?')) {
                                onDeleteCourse(card.id)
                                setCourseOptionsOpenId(null)
                              }
                            }}
                          >
                            <FiTrash2 /> Supprimer
                          </button>
                        )}
                        <button
                          type="button"
                          className="course-card__options-item"
                          role="menuitem"
                          onClick={() => {
                            setFavorites((prev) => {
                              const next = new Set(prev)
                              if (next.has(card.id)) next.delete(card.id)
                              else next.add(card.id)
                              try {
                                localStorage.setItem(FAVORITES_KEY, JSON.stringify([...next]))
                              } catch {
                                //
                              }
                              return next
                            })
                            setCourseOptionsOpenId(null)
                          }}
                        >
                          <FiStar style={{ fill: favorites.has(card.id) ? 'currentColor' : undefined }} />
                          {favorites.has(card.id) ? ' Retirer des favoris' : ' Ajouter aux favoris'}
                        </button>
                      </div>
                    )}
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
                    <p>Début du parcours</p>
                    <p className="course-card__countdown">{card.countdown}</p>
                  </div>
                </footer>
                {card.courseRaw?.startCoordinates && card.courseRaw.startCoordinates.length === 2 && (
                  <CourseCardWeather lat={card.courseRaw.startCoordinates[0]} lon={card.courseRaw.startCoordinates[1]} />
                )}
              </article>
            ))}
            </div>
          </section>

          <section className="courses-my-parcours">
            <div className="courses-my-parcours__heading">
              <h2 className="courses-my-parcours__title">Mes parcours en cours</h2>
              <p className="courses-my-parcours__subtitle">
                {myParcoursCards.length > 0
                  ? `${myParcoursCards.length} parcours`
                  : "Aucun parcours. Créez-en un ou choisissez-en un depuis le détail d'un parcours."}
              </p>
            </div>
            <div className="courses-my-parcours__grid">
              {myParcoursCards.map((card) => (
                <article
                  key={card.id}
                  className="course-card"
                  role="button"
                  tabIndex={0}
                  onClick={() => courseOptionsOpenId !== card.id && onSelectCourse?.(card.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') onSelectCourse?.(card.id)
                  }}
                >
                  <div className="course-card__top">
                    <div className="course-card__gpx">
                      {card.gpxSvg ? (
                        <div className="course-card__gpx-svg" dangerouslySetInnerHTML={{ __html: card.gpxSvg }} />
                      ) : (
                        <img src={gpxIcon} alt="GPX" />
                      )}
                    </div>
                    <div className="course-card__content">
                      <h3 className="course-card__title">{card.subtitle}</h3>
                      <p className="course-card__stats">{card.stats}</p>
                    </div>
                    <div className="course-card__options-wrap">
                      <button
                        type="button"
                        className="course-card__options-btn"
                        onClick={(e) => {
                          e.stopPropagation()
                          setCourseOptionsOpenId((id) => (id === card.id ? null : card.id))
                        }}
                        aria-label="Options"
                        aria-expanded={courseOptionsOpenId === card.id}
                        aria-haspopup="true"
                      >
                        <FiMoreVertical aria-hidden />
                      </button>
                      {courseOptionsOpenId === card.id && (
                        <div className="course-card__options-dropdown" role="menu" onClick={(e) => e.stopPropagation()}>
                          <button
                            type="button"
                            className="course-card__options-item"
                            role="menuitem"
                            onClick={() => {
                              setCourseOptionsOpenId(null)
                              if (onUpdateCourse) setEditingCourse(card.courseRaw)
                              else onSelectCourse?.(card.id)
                            }}
                          >
                            <FiEdit3 /> Modifier
                          </button>
                          {onDeleteCourse && (
                            <button
                              type="button"
                              className="course-card__options-item course-card__options-item--danger"
                              role="menuitem"
                              onClick={() => {
                                if (window.confirm('Supprimer ce parcours ?')) {
                                  onDeleteCourse(card.id)
                                  setCourseOptionsOpenId(null)
                                }
                              }}
                            >
                              <FiTrash2 /> Supprimer
                            </button>
                          )}
                          <button
                            type="button"
                            className="course-card__options-item"
                            role="menuitem"
                            onClick={() => {
                              setFavorites((prev) => {
                                const next = new Set(prev)
                                if (next.has(card.id)) next.delete(card.id)
                                else next.add(card.id)
                                try { localStorage.setItem(FAVORITES_KEY, JSON.stringify([...next])) } catch { /* */ }
                                return next
                              })
                              setCourseOptionsOpenId(null)
                            }}
                          >
                            <FiStar style={{ fill: favorites.has(card.id) ? 'currentColor' : undefined }} />
                            {favorites.has(card.id) ? ' Retirer des favoris' : ' Ajouter aux favoris'}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                  <footer className="course-card__footer">
                    <div className="course-card__footer-left">
                      <p className="course-card__footer-prep">État de préparation : <strong>{card.readiness}</strong></p>
                    </div>
                    <div className="course-card__footer-right">
                      <p>Début du parcours</p>
                      <p className="course-card__countdown">{card.countdown}</p>
                    </div>
                  </footer>
                  {card.courseRaw?.startCoordinates && card.courseRaw.startCoordinates.length === 2 && (
                    <CourseCardWeather lat={card.courseRaw.startCoordinates[0]} lon={card.courseRaw.startCoordinates[1]} />
                  )}
                </article>
              ))}
            </div>
          </section>
        </main>
      </div>

      {isCreateModalOpen && (
        <div className="modal-overlay" role="dialog" aria-modal="true">
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
              <label className="modal-upload-simple__button" htmlFor="course-image-page">
                <span className="modal-upload-simple__icon">+</span>
                <span className="modal-upload-simple__text">Télécharger une image pour le parcours</span>
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
                <span className="modal-upload-simple__text">Télécharger un fichier GPX pour le parcours</span>
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
                Nom du parcours<span className="modal-field__required">*</span>
              </label>
              <input
                id="course-name-page"
                className="modal-input"
                type="text"
                placeholder="UTMB"
                ref={courseNameRef}
              />
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
            <div className="modal-field">
              <label htmlFor="course-date-page">Date du parcours</label>
              <input
                id="course-date-page"
                className="modal-input"
                type="date"
                ref={courseDateRef}
                aria-describedby="course-date-hint"
              />
              <p id="course-date-hint" className="modal-field__hint">Pour la météo et la simulation (départ jour J)</p>
            </div>
            <div className="modal-field">
              <label htmlFor="course-time-page">Heure de départ</label>
              <input
                id="course-time-page"
                className="modal-input"
                type="time"
                defaultValue="08:00"
                ref={courseTimeRef}
                aria-describedby="course-time-hint"
              />
              <p id="course-time-hint" className="modal-field__hint">Heure imposée par l&apos;organisation (ex: 09:00)</p>
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
              En créant un parcours tu acceptes{' '}
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

      {editingCourse && (
        <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="edit-course-title">
          <div className="modal modal--form">
            <header className="modal__header modal__header--center">
              <h2 id="edit-course-title">Modifier le parcours</h2>
              <button
                type="button"
                className="modal__close"
                onClick={() => setEditingCourse(null)}
                aria-label="Fermer"
              >
                <HiX />
              </button>
            </header>
            <div className="modal-upload-simple">
              <label className="modal-upload-simple__button" htmlFor="edit-course-image">
                <span className="modal-upload-simple__icon">+</span>
                <span className="modal-upload-simple__text">
                  {editingCourse.imageUrl ? "Changer l'image" : "Télécharger une image pour le parcours"}
                </span>
              </label>
              <input
                id="edit-course-image"
                className="modal-upload-simple__input"
                type="file"
                accept="image/*"
                ref={editImageRef}
              />
              {editingCourse.imageUrl && (
                <p className="modal-field__hint">Image actuelle conservée si vous ne choisissez pas un nouveau fichier.</p>
              )}
            </div>
            <div className="modal-upload-simple">
              <label className="modal-upload-simple__button" htmlFor="edit-course-gpx">
                <span className="modal-upload-simple__icon">+</span>
                <span className="modal-upload-simple__text">
                  {editingCourse.gpxName ? 'Remplacer le GPX' : 'Télécharger un fichier GPX'}
                </span>
              </label>
              <input
                id="edit-course-gpx"
                className="modal-upload-simple__input"
                type="file"
                accept=".gpx,application/gpx+xml,application/xml,text/xml"
                ref={editGpxRef}
              />
              {editingCourse.gpxName && (
                <p className="modal-field__hint">Fichier actuel : {editingCourse.gpxName}</p>
              )}
            </div>
            <div className="modal-field">
              <label htmlFor="edit-course-name">
                Nom du parcours<span className="modal-field__required">*</span>
              </label>
              <input
                id="edit-course-name"
                className="modal-input"
                type="text"
                placeholder="UTMB"
                ref={editNameRef}
              />
            </div>
            <div className="modal-field">
              <label htmlFor="edit-course-date">Date du parcours</label>
              <input
                id="edit-course-date"
                className="modal-input"
                type="date"
                ref={editDateRef}
              />
            </div>
            <div className="modal-field">
              <label htmlFor="edit-course-time">Heure de départ</label>
              <input
                id="edit-course-time"
                className="modal-input"
                type="time"
                ref={editTimeRef}
                aria-describedby="edit-course-time-hint"
              />
              <p id="edit-course-time-hint" className="modal-field__hint">Heure imposée par l&apos;organisation</p>
            </div>
            <div className="modal-actions">
              <button className="modal-back" type="button" onClick={() => setEditingCourse(null)}>
                Annuler
              </button>
              <button className="modal-primary" type="button" onClick={handleEditCourse}>
                Enregistrer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
