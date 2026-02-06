import { useEffect, useState } from 'react'

import './App.css'
import WebGlGlobe from './components/WebGlGlobe'
import CoursesPage from './pages/CoursesPage'
import EventsPage from './pages/EventsPage'
import SaisonPage from './pages/SaisonPage'
import SingleCoursePage from './pages/SingleCoursePage'
import StravaCallbackPage from './pages/StravaCallbackPage'
import UserAccountPage from './pages/UserAccountPage'
import { supabase, type EventRow, type CourseRow } from './lib/supabase'
import { gpxToSvg, computeGpxStats, extractGpxStartCoordinates, getBoundsFromGpx, samplePointsAlongTrack, type GpxBounds } from './lib/gpxToSvg'

type AppView = 'saison' | 'course' | 'events' | 'courses' | 'strava-callback' | 'account'

type CourseItem = {
  id: string
  name: string
  imageUrl?: string
  gpxName?: string
  gpxSvg?: string
  distanceKm?: number
  elevationGain?: number
  profile?: Array<[number, number]>
  stravaRouteId?: string
  stravaSegments?: Array<{
    id: number
    name: string
    distance: number
    elevation_gain: number
    average_grade: number
    type: 'climb' | 'descent' | 'flat'
  }>
  startCoordinates?: [number, number]
  /** Points échantillonnés le long du tracé pour météo (pluie par segment) */
  weatherSamplePoints?: Array<[number, number]>
  /** Bornes du GPX pour placer les gouttes sur le SVG */
  gpxBounds?: GpxBounds
}

type EventItem = {
  id: string
  name: string
  country: string
  startLabel: string
  imageUrl?: string
  courses: CourseItem[]
}

// Fonction utilitaire pour convertir une URL blob en base64
async function blobUrlToBase64(blobUrl: string): Promise<string | undefined> {
  try {
    const response = await fetch(blobUrl)
    const blob = await response.blob()
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onloadend = () => {
        const base64 = reader.result as string
        resolve(base64)
      }
      reader.onerror = reject
      reader.readAsDataURL(blob)
    })
  } catch {
    return undefined
  }
}

/** Préfixe la course exemple Grand Raid (dev et prod) si le GPX est disponible */
async function prependExampleCourse(events: EventItem[]): Promise<EventItem[]> {
  const ex = await loadExampleCourse()
  if (ex.length === 0) return events
  const exampleIds = new Set(ex.map((e) => e.id))
  return [...ex, ...events.filter((e) => !exampleIds.has(e.id))]
}

/** Course exemple avec le tracé GPX Grand Raid (public/data/grand-raid-exemple.gpx) */
async function loadExampleCourse(): Promise<EventItem[]> {
  try {
    const base = typeof window !== 'undefined' ? window.location.origin : ''
    const res = await fetch(`${base}/data/grand-raid-exemple.gpx`)
    if (!res.ok) return []
    const gpxText = await res.text()
    const stats = computeGpxStats(gpxText)
    const startCoordinates = extractGpxStartCoordinates(gpxText) ?? undefined
    if (!stats) return []

    const gpxSvg = gpxToSvg(gpxText)
    const weatherSamplePoints = samplePointsAlongTrack(gpxText, 15)
    const gpxBounds = getBoundsFromGpx(gpxText) ?? undefined

    const course: CourseItem = {
      id: 'example-grand-raid-course',
      name: 'Grand Raid (exemple)',
      distanceKm: stats.distanceKm,
      elevationGain: stats.elevationGain,
      profile: stats.profile,
      gpxName: 'grand-raid-exemple.gpx',
      gpxSvg,
      startCoordinates,
      weatherSamplePoints,
      gpxBounds,
    }

    const event: EventItem = {
      id: 'example-grand-raid-event',
      name: 'Grand Raid Réunion',
      country: 'La Réunion',
      startLabel: 'Exemple · tracé GPX inclus',
      courses: [course],
    }

    return [event]
  } catch {
    return []
  }
}

// Fonction pour charger les events depuis Supabase
async function loadEventsFromSupabase(): Promise<EventItem[]> {
  try {
    // Charger les events avec leurs courses
    const { data: eventsData, error: eventsError } = await supabase
      .from('events')
      .select('*')
      .order('created_at', { ascending: false })

    if (eventsError) {
      // En dev (ex. pas de réseau / Supabase indisponible), on affiche la course exemple sans polluer la console
      if (import.meta.env.DEV) {
        console.warn('Supabase indisponible (dev), utilisation de la course exemple.')
      } else {
        console.error('Erreur lors du chargement des events:', eventsError)
      }
      return prependExampleCourse([])
    }

    if (!eventsData || eventsData.length === 0) {
      // Charger la course exemple Grand Raid (tracé GPX dans public/data)
      const example = await loadExampleCourse()
      if (example.length > 0) return example
      return []
    }

    // Charger les courses pour chaque event
    const { data: coursesData, error: coursesError } = await supabase
      .from('courses')
      .select('*')
      .order('created_at', { ascending: false })

    if (coursesError) {
      // Gérer silencieusement les erreurs de permission (RLS) pour les utilisateurs non connectés
      if (coursesError.code === 'PGRST116' || coursesError.code === '42501' || coursesError.code === 'PGRST301') {
        console.warn('⚠️ Erreur de permission lors du chargement des courses (utilisateur non connecté ou RLS):', {
          code: coursesError.code,
          message: coursesError.message,
          hint: coursesError.hint,
          eventsCount: eventsData.length,
        })
        // Retourner les events sans courses - CoursesPage chargera les courses directement
        return prependExampleCourse(
          eventsData.map((event: EventRow) => ({
            id: event.id,
            name: event.name,
            country: event.country,
            startLabel: event.start_label,
            imageUrl: event.image_url || undefined,
            courses: [],
          }))
        )
      }
      console.error('Erreur lors du chargement des courses:', {
        code: coursesError.code,
        message: coursesError.message,
        hint: coursesError.hint,
        details: coursesError,
      })
      return prependExampleCourse(
        eventsData.map((event: EventRow) => ({
          id: event.id,
          name: event.name,
          country: event.country,
          startLabel: event.start_label,
          imageUrl: event.image_url || undefined,
          courses: [],
        }))
      )
    }

    console.log('[App] Courses chargées depuis Supabase:', {
      coursesCount: coursesData?.length || 0,
      eventsCount: eventsData.length,
    })

    // Transformer les données Supabase en EventItem[]
    const eventsMap = new Map<string, EventItem>()
    eventsData.forEach((event: EventRow) => {
      eventsMap.set(event.id, {
        id: event.id,
        name: event.name,
        country: event.country,
        startLabel: event.start_label,
        imageUrl: event.image_url || undefined,
        courses: [],
      })
    })

    // Associer les courses à leurs events
    if (coursesData && coursesData.length > 0) {
      console.log('[App] Association des courses aux events...')
      let coursesWithoutEvent = 0
      coursesData.forEach((course: CourseRow) => {
        const event = eventsMap.get(course.event_id)
        if (event) {
          // Parser le profile si c'est une string JSON, sinon utiliser directement
          let profile: Array<[number, number]> | undefined = undefined
          if (course.profile) {
            if (typeof course.profile === 'string') {
              try {
                profile = JSON.parse(course.profile)
              } catch {
                profile = undefined
              }
            } else if (Array.isArray(course.profile)) {
              profile = course.profile as Array<[number, number]>
            }
          }

          // Parser les segments Strava si présents
          let stravaSegments: Array<{
            id: number
            name: string
            distance: number
            elevation_gain: number
            average_grade: number
            type: 'climb' | 'descent' | 'flat'
          }> | undefined = undefined
          if (course.strava_segments) {
            if (typeof course.strava_segments === 'string') {
              try {
                stravaSegments = JSON.parse(course.strava_segments)
              } catch {
                stravaSegments = undefined
              }
            } else if (Array.isArray(course.strava_segments)) {
              stravaSegments = course.strava_segments as Array<{
                id: number
                name: string
                distance: number
                elevation_gain: number
                average_grade: number
                type: 'climb' | 'descent' | 'flat'
              }>
            }
          }

          event.courses.push({
            id: course.id,
            name: course.name,
            imageUrl: course.image_url || undefined,
            gpxName: course.gpx_name || undefined,
            gpxSvg: course.gpx_svg || undefined,
            distanceKm: course.distance_km || undefined,
            elevationGain: course.elevation_gain || undefined,
            profile,
            stravaRouteId: course.strava_route_id || undefined,
            stravaSegments,
            startCoordinates: course.start_coordinates && Array.isArray(course.start_coordinates) && course.start_coordinates.length === 2
              ? [course.start_coordinates[0], course.start_coordinates[1]] as [number, number]
              : undefined,
          })
        } else {
          coursesWithoutEvent++
          console.warn(`[App] Course "${course.name}" (${course.id}) n'a pas d'event parent (event_id: ${course.event_id})`)
        }
      })
      
      if (coursesWithoutEvent > 0) {
        console.warn(`[App] ${coursesWithoutEvent} course(s) sans event parent`)
      }
      
      console.log('[App] Résultat final:', {
        eventsCount: eventsMap.size,
        totalCourses: Array.from(eventsMap.values()).reduce((sum, e) => sum + e.courses.length, 0),
      })
    } else {
      console.warn('[App] Aucune course chargée depuis Supabase')
    }

    return prependExampleCourse(Array.from(eventsMap.values()))
  } catch (error) {
    console.error('Erreur lors du chargement depuis Supabase:', error)
    return prependExampleCourse([])
  }
}

function App() {
  const [view, setView] = useState<AppView>(() => {
    // Détecter si on est sur la page de callback Strava
    if (typeof window !== 'undefined' && window.location.pathname === '/auth/strava/callback') {
      return 'strava-callback'
    }
    try {
      const stored = localStorage.getItem('vizion:view')
      return (stored as AppView) || 'saison'
    } catch {
      return 'saison'
    }
  })

  // Écouter les changements d'URL pour détecter le callback Strava
  useEffect(() => {
    if (typeof window !== 'undefined' && window.location.pathname === '/auth/strava/callback') {
      setView('strava-callback')
    }
  }, [])
  const [events, setEvents] = useState<EventItem[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedEventId, setSelectedEventId] = useState<string | null>(() => {
    try {
      return localStorage.getItem('vizion:selectedEventId')
    } catch {
      return null
    }
  })
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(() => {
    try {
      return localStorage.getItem('vizion:selectedCourseId')
    } catch {
      return null
    }
  })

  const handleCreateEvent = async (payload: { name: string; imageUrl?: string }) => {
    const cleanName = payload.name.trim()
    if (!cleanName || cleanName.toLowerCase() === 'sans titre') {
      return
    }

    // Convertir l'image blob URL en base64 si nécessaire
    let imageUrl = payload.imageUrl
    if (imageUrl && imageUrl.startsWith('blob:')) {
      imageUrl = await blobUrlToBase64(imageUrl)
    }

    // Insérer dans Supabase
    const { error } = await supabase
      .from('events')
      .insert({
        name: cleanName,
        country: 'Publiée',
        start_label: 'À définir',
        image_url: imageUrl || null,
      })

    if (error) {
      console.error('Erreur lors de la création de l\'event:', error)
      return
    }

    // Recharger les events depuis Supabase
    const loadedEvents = await loadEventsFromSupabase()
    setEvents(loadedEvents)
  }

  const handleCreateCourse = async (payload: {
    name: string
    imageUrl?: string
    gpxName?: string
    gpxSvg?: string
    distanceKm?: number
    elevationGain?: number
    profile?: Array<[number, number]>
    startCoordinates?: [number, number] // [lat, lon]
    stravaRouteId?: string
    stravaSegments?: Array<{
      id: number
      name: string
      distance: number
      elevation_gain: number
      average_grade: number
      type: 'climb' | 'descent' | 'flat'
    }>
  }) => {
    console.log('📥 App.tsx handleCreateCourse appelé avec:', {
      name: payload.name,
      hasImage: !!payload.imageUrl,
      hasGpx: !!payload.gpxSvg,
      hasStravaRoute: !!payload.stravaRouteId,
      hasSegments: !!payload.stravaSegments,
    })

    const cleanName = payload.name.trim()
    if (!cleanName || cleanName.toLowerCase() === 'sans titre') {
      console.warn('⚠️ Nom invalide, annulation')
      alert('Veuillez entrer un nom de course valide')
      return
    }

    // Convertir les blob URLs en base64 si nécessaire
    let imageUrl = payload.imageUrl
    if (imageUrl && imageUrl.startsWith('blob:')) {
      console.log('🖼️ Conversion image blob → base64...')
      imageUrl = await blobUrlToBase64(imageUrl)
      console.log('✅ Image convertie:', !!imageUrl)
    }

    // Le SVG est déjà une string, pas besoin de conversion
    const gpxSvg = payload.gpxSvg

    // Déterminer l'event_id à utiliser
    let eventIdToUse: string | null = null

    // 1. Vérifier si un event_id est sélectionné et existe dans la base
    if (selectedEventId) {
      const { data: existingEvent } = await supabase
        .from('events')
        .select('id')
        .eq('id', selectedEventId)
        .single()

      if (existingEvent) {
        eventIdToUse = selectedEventId
        console.log('✅ Utilisation de l\'événement sélectionné:', eventIdToUse)
      }
    }

    // 2. Si pas d'event valide, vérifier le premier event de la liste
    if (!eventIdToUse && events.length > 0 && events[0]?.id) {
      const { data: existingEvent } = await supabase
        .from('events')
        .select('id')
        .eq('id', events[0].id)
        .single()

      if (existingEvent) {
        eventIdToUse = events[0].id
        console.log('✅ Utilisation du premier événement de la liste:', eventIdToUse)
      }
    }

    // 3. Si toujours pas d'event valide, créer un nouvel événement
    if (!eventIdToUse) {
      console.log('📝 Création d\'un nouvel événement...')
      const { data: newEvent, error: eventError } = await supabase
        .from('events')
        .insert({
          name: 'Nouvel événement',
          country: 'Publiée',
          start_label: 'À définir',
        })
        .select()
        .single()

      if (eventError) {
        console.error('❌ Erreur lors de la création de l\'événement:', eventError)
        console.error('Détails complets:', JSON.stringify(eventError, null, 2))
        alert(`Erreur lors de la création de l'événement: ${eventError.message}\n\nCode: ${eventError.code}\n\nVérifiez la console pour plus de détails.`)
        return
      }

      if (!newEvent || !newEvent.id) {
        console.error('❌ L\'événement a été créé mais n\'a pas d\'ID:', newEvent)
        alert('Erreur: l\'événement a été créé mais n\'a pas d\'ID. Veuillez réessayer.')
        return
      }

      eventIdToUse = newEvent.id
      console.log('✅ Nouvel événement créé avec ID:', eventIdToUse, 'Données complètes:', newEvent)

      // Vérifier immédiatement que l'event existe en base
      const { data: verifyEvent, error: verifyError } = await supabase
        .from('events')
        .select('id')
        .eq('id', eventIdToUse)
        .single()

      if (verifyError || !verifyEvent) {
        console.error('❌ ERREUR: L\'événement créé n\'existe pas en base:', verifyError)
        alert('Erreur: l\'événement a été créé mais n\'est pas accessible. Problème de permissions possible.')
        return
      }

      console.log('✅ Vérification immédiate OK, event existe:', verifyEvent.id)

      // Recharger les events pour avoir le nouvel event dans la liste
      const loadedEvents = await loadEventsFromSupabase()
      setEvents(loadedEvents)
      setSelectedEventId(eventIdToUse)
    }

    // Vérification finale : eventIdToUse DOIT être défini
    if (!eventIdToUse) {
      console.error('❌ ERREUR CRITIQUE: eventIdToUse est null après toutes les vérifications')
      alert('Erreur critique: impossible de déterminer un événement valide. Veuillez réessayer.')
      return
    }

    // Vérifier une dernière fois que l'event existe vraiment en base
    const { data: finalCheck, error: checkError } = await supabase
      .from('events')
      .select('id')
      .eq('id', eventIdToUse)
      .single()

    if (checkError || !finalCheck) {
      console.error('❌ ERREUR: L\'événement n\'existe pas en base:', eventIdToUse, checkError)
      alert(`Erreur: l'événement sélectionné n'existe pas en base de données. Veuillez réessayer.`)
      return
    }

    console.log('✅ Vérification finale OK, event_id valide:', eventIdToUse)

    // Insérer dans Supabase avec un event_id valide
    // Arrondir elevation_gain à 2 décimales
    const elevationGainRounded = payload.elevationGain
      ? Number(payload.elevationGain.toFixed(2))
      : null

    const { error, data } = await supabase.from('courses').insert({
      event_id: eventIdToUse,
      name: cleanName,
      image_url: imageUrl || null,
      gpx_name: payload.gpxName || null,
      gpx_svg: gpxSvg || null,
      distance_km: payload.distanceKm || null,
      elevation_gain: elevationGainRounded,
      profile: payload.profile ? JSON.stringify(payload.profile) : null,
      start_coordinates: payload.startCoordinates || null,
      strava_route_id: payload.stravaRouteId || null,
      strava_segments: payload.stravaSegments ? JSON.stringify(payload.stravaSegments) : null,
    }).select()

    if (error) {
      console.error('❌ Erreur lors de la création de la course:', error)
      console.error('Détails:', JSON.stringify(error, null, 2))
      alert(`Erreur lors de la création de la course: ${error.message}`)
      return
    }

    console.log('✅ Course créée avec succès:', data)

    // Recharger les events depuis Supabase
    const loadedEvents = await loadEventsFromSupabase()
    setEvents(loadedEvents)
    setSelectedEventId(eventIdToUse)
    setView('courses')
    console.log('✅ Events rechargés, total:', loadedEvents.length)
  }

  const handleSelectEvent = (eventId: string) => {
    setSelectedEventId(eventId)
    setView('courses')
  }

  const handleEditEvent = (eventId: string) => {
    // TODO: Implémenter l'édition d'un événement
    console.log('Édition de l\'événement:', eventId)
    alert('Fonctionnalité d\'édition à venir')
  }

  const handleDeleteEvent = async (eventId: string) => {
    // Supprimer l'événement et ses courses associées
    const { error } = await supabase.from('events').delete().eq('id', eventId)

    if (error) {
      console.error('Erreur lors de la suppression de l\'événement:', error)
      alert('Erreur lors de la suppression de l\'événement')
      return
    }

    // Recharger les events depuis Supabase
    const loadedEvents = await loadEventsFromSupabase()
    setEvents(loadedEvents)
  }

  const handleSelectCourse = (courseId: string) => {
    setSelectedCourseId(courseId)
    setView('course')
  }

  const handleNavigate = (nextView: AppView) => {
    console.log('[App] handleNavigate appelé avec:', nextView)
    // Scroll immédiat vers le haut avant de changer de vue pour éviter le sursaut
    window.scrollTo({ top: 0, behavior: 'instant' })
    // Utiliser requestAnimationFrame pour s'assurer que le scroll est terminé avant le changement de vue
    requestAnimationFrame(() => {
      setView(nextView)
    })
  }

  useEffect(() => {
    try {
      localStorage.setItem('vizion:view', view)
    } catch {
      // Pas de stockage dispo
    }
  }, [view])

  useEffect(() => {
    try {
      if (selectedEventId) {
        localStorage.setItem('vizion:selectedEventId', selectedEventId)
      }
    } catch {
      // Pas de stockage dispo
    }
  }, [selectedEventId])

  useEffect(() => {
    try {
      if (selectedCourseId) {
        localStorage.setItem('vizion:selectedCourseId', selectedCourseId)
      }
    } catch {
      // Pas de stockage dispo
    }
  }, [selectedCourseId])

  // Charger les events depuis Supabase au démarrage
  useEffect(() => {
    const loadEvents = async () => {
      setLoading(true)
      const loadedEvents = await loadEventsFromSupabase()
      setEvents(loadedEvents)
      setLoading(false)
    }
    loadEvents()
  }, [])

  if (loading) {
    return (
      <div className="app-root" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
        <p>Chargement...</p>
      </div>
    )
  }

  return (
    <div className={`app-root${view === 'saison' ? ' app-root--globe-interactive' : ''}`}>
      <div className="app-bg-globe" aria-hidden={view !== 'saison'}>
        <WebGlGlobe />
      </div>
      <div className="app-content">
      {view === 'saison' && (
        <SaisonPage
          onCourseSelect={() => setView('course')}
          onNavigate={handleNavigate}
          onCreateEvent={handleCreateEvent}
          onCreateCourse={handleCreateCourse}
        />
      )}
      {view === 'course' && (
        <SingleCoursePage
          onNavigate={handleNavigate}
          events={events}
          selectedCourseId={selectedCourseId}
        />
      )}
      {view === 'events' && (
        <EventsPage
          onNavigate={handleNavigate}
          events={events}
          onEventSelect={handleSelectEvent}
          onEventEdit={handleEditEvent}
          onEventDelete={handleDeleteEvent}
          onCreateEvent={handleCreateEvent}
        />
      )}
      {view === 'courses' && (
        <CoursesPage
          onNavigate={handleNavigate}
          events={events}
          selectedEventId={selectedEventId}
          onSelectCourse={handleSelectCourse}
          onCreateCourse={handleCreateCourse}
        />
      )}
      {view === 'strava-callback' && (
        <StravaCallbackPage
          onAuthSuccess={() => {
            setView('saison')
            window.history.replaceState({}, '', '/')
          }}
        />
      )}
      {view === 'account' && (
        <UserAccountPage
          onNavigate={handleNavigate}
        />
      )}
      </div>
    </div>
  )
}

export default App
