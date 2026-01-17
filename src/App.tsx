import { useEffect, useState } from 'react'

import './App.css'
import CoursesPage from './pages/CoursesPage'
import EventsPage from './pages/EventsPage'
import SaisonPage from './pages/SaisonPage'
import SingleCoursePage from './pages/SingleCoursePage'
import StravaCallbackPage from './pages/StravaCallbackPage'
import UserAccountPage from './pages/UserAccountPage'
import { supabase, type EventRow, type CourseRow } from './lib/supabase'

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

// Fonction pour charger les events depuis Supabase
async function loadEventsFromSupabase(): Promise<EventItem[]> {
  try {
    // Charger les events avec leurs courses
    const { data: eventsData, error: eventsError } = await supabase
      .from('events')
      .select('*')
      .order('created_at', { ascending: false })

    if (eventsError) {
      console.error('Erreur lors du chargement des events:', eventsError)
      return []
    }

    if (!eventsData || eventsData.length === 0) {
      // Retourner un tableau vide si rien n'est stocké
      // Les données par défaut seront créées lors de la première création d'event/course
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
        console.warn('⚠️ Erreur de permission lors du chargement des courses (utilisateur non connecté ou RLS):', coursesError.message)
        return eventsData.map((event: EventRow) => ({
          id: event.id,
          name: event.name,
          country: event.country,
          startLabel: event.start_label,
          imageUrl: event.image_url || undefined,
          courses: [],
        }))
      }
      console.error('Erreur lors du chargement des courses:', coursesError)
      return eventsData.map((event: EventRow) => ({
        id: event.id,
        name: event.name,
        country: event.country,
        startLabel: event.start_label,
        imageUrl: event.image_url || undefined,
        courses: [],
      }))
    }

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
    if (coursesData) {
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
        }
      })
    }

    return Array.from(eventsMap.values())
  } catch (error) {
    console.error('Erreur lors du chargement depuis Supabase:', error)
    return []
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

    let fallbackEventId = selectedEventId ?? events[0]?.id
    console.log('🎯 Event ID sélectionné:', fallbackEventId)

    // Si aucun event n'existe, créer un event par défaut
    if (!fallbackEventId) {
      console.log('📝 Création d\'un event par défaut...')
      const { data: newEvent, error: eventError } = await supabase
        .from('events')
        .insert({
          name: 'Nouvel événement',
          country: 'Publiée',
          start_label: 'À définir',
        })
        .select()
        .single()

      if (eventError || !newEvent) {
        console.error('❌ Erreur lors de la création de l\'event par défaut:', eventError)
        alert('Erreur lors de la création de l\'événement. Vérifiez la console.')
        return
      }

      fallbackEventId = newEvent.id
      setSelectedEventId(fallbackEventId)
      console.log('✅ Event par défaut créé:', fallbackEventId)

      // Recharger les events pour avoir le nouvel event dans la liste
      const loadedEvents = await loadEventsFromSupabase()
      setEvents(loadedEvents)
    }

    setSelectedEventId(fallbackEventId)
    setView('courses')

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

    // Vérifier que l'event_id existe dans la base (ne doit pas être un ID par défaut comme 'event-1')
    const isValidUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(fallbackEventId)
    if (!isValidUuid) {
      console.warn('⚠️ L\'event_id n\'est pas un UUID valide:', fallbackEventId)
      // Si c'est un ID par défaut, créer l'event d'abord
      const { data: newEvent, error: eventError } = await supabase
        .from('events')
        .insert({
          name: 'Grand Raid',
          country: 'Ile de la Réunion',
          start_label: '6 mois',
        })
        .select()
        .single()

      if (eventError || !newEvent) {
        console.error('❌ Erreur lors de la création de l\'event par défaut:', eventError)
        alert('Erreur lors de la création de l\'événement. Vérifiez la console.')
        return
      }

      // Utiliser le nouvel event_id
      const newEventId = newEvent.id
      console.log('✅ Nouvel event créé:', newEventId)

      // Insérer la course avec le nouvel event_id
      // Arrondir elevation_gain à 2 décimales
      const elevationGainRounded = payload.elevationGain
        ? Number(payload.elevationGain.toFixed(2))
        : null

      console.log('💾 Insertion course dans Supabase...')
      const { error, data } = await supabase.from('courses').insert({
        event_id: newEventId,
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
      setSelectedEventId(newEventId)
      return
    }

    // Insérer dans Supabase avec un event_id valide
    // Arrondir elevation_gain à 2 décimales
    const elevationGainRounded = payload.elevationGain
      ? Number(payload.elevationGain.toFixed(2))
      : null

    console.log('💾 Insertion course dans Supabase avec event_id:', fallbackEventId)
    const { error, data } = await supabase.from('courses').insert({
      event_id: fallbackEventId,
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
    setView(nextView)
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
    <div className="app-root">
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
        />
      )}
      {view === 'courses' && (
        <CoursesPage
          onNavigate={handleNavigate}
          events={events}
          selectedEventId={selectedEventId}
          onSelectCourse={handleSelectCourse}
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
  )
}

export default App
