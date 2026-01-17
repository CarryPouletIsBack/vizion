import { useEffect, useState } from 'react'

import './App.css'
import CoursesPage from './pages/CoursesPage'
import EventsPage from './pages/EventsPage'
import SaisonPage from './pages/SaisonPage'
import SingleCoursePage from './pages/SingleCoursePage'
import { supabase, type EventRow, type CourseRow } from './lib/supabase'

type AppView = 'saison' | 'course' | 'events' | 'courses'

type CourseItem = {
  id: string
  name: string
  imageUrl?: string
  gpxName?: string
  gpxSvg?: string
  distanceKm?: number
  elevationGain?: number
  profile?: Array<[number, number]>
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
      // Données par défaut si rien n'est stocké
      return [
        {
          id: 'event-1',
          name: 'Grand Raid',
          country: 'Ile de la Réunion',
          startLabel: '6 mois',
          imageUrl: undefined,
          courses: [
            { id: 'course-1', name: 'Grand raid' },
          ],
        },
      ]
    }

    // Charger les courses pour chaque event
    const { data: coursesData, error: coursesError } = await supabase
      .from('courses')
      .select('*')
      .order('created_at', { ascending: false })

    if (coursesError) {
      console.error('Erreur lors du chargement des courses:', coursesError)
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
          event.courses.push({
            id: course.id,
            name: course.name,
            imageUrl: course.image_url || undefined,
            gpxName: course.gpx_name || undefined,
            gpxSvg: course.gpx_svg || undefined,
            distanceKm: course.distance_km || undefined,
            elevationGain: course.elevation_gain || undefined,
            profile: course.profile || undefined,
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
    try {
      const stored = localStorage.getItem('vizion:view')
      return (stored as AppView) || 'saison'
    } catch {
      return 'saison'
    }
  })
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
  }) => {
    const fallbackEventId = selectedEventId ?? events[0]?.id
    if (!fallbackEventId) {
      console.error('Aucun event sélectionné pour créer la course')
      return
    }

    setSelectedEventId(fallbackEventId)
    setView('courses')

    const cleanName = payload.name.trim()
    if (!cleanName || cleanName.toLowerCase() === 'sans titre') {
      return
    }

    // Convertir les blob URLs en base64 si nécessaire
    let imageUrl = payload.imageUrl
    if (imageUrl && imageUrl.startsWith('blob:')) {
      imageUrl = await blobUrlToBase64(imageUrl)
    }

    // Le SVG est déjà une string, pas besoin de conversion
    const gpxSvg = payload.gpxSvg

    // Insérer dans Supabase
    const { error } = await supabase.from('courses').insert({
      event_id: fallbackEventId,
      name: cleanName,
      image_url: imageUrl || null,
      gpx_name: payload.gpxName || null,
      gpx_svg: gpxSvg || null,
      distance_km: payload.distanceKm || null,
      elevation_gain: payload.elevationGain || null,
      profile: payload.profile || null,
    })

    if (error) {
      console.error('Erreur lors de la création de la course:', error)
      return
    }

    // Recharger les events depuis Supabase
    const loadedEvents = await loadEventsFromSupabase()
    setEvents(loadedEvents)
  }

  const handleSelectEvent = (eventId: string) => {
    setSelectedEventId(eventId)
    setView('courses')
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
        <EventsPage onNavigate={handleNavigate} events={events} onEventSelect={handleSelectEvent} />
      )}
      {view === 'courses' && (
        <CoursesPage
          onNavigate={handleNavigate}
          events={events}
          selectedEventId={selectedEventId}
          onSelectCourse={handleSelectCourse}
        />
      )}
    </div>
  )
}

export default App
