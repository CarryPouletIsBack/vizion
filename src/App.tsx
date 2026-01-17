import { useEffect, useState } from 'react'

import './App.css'
import CoursesPage from './pages/CoursesPage'
import EventsPage from './pages/EventsPage'
import SaisonPage from './pages/SaisonPage'
import SingleCoursePage from './pages/SingleCoursePage'

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

// Fonction pour charger les events depuis localStorage
function loadEventsFromStorage(): EventItem[] {
  try {
    const stored = localStorage.getItem('vizion:events')
    if (stored) {
      return JSON.parse(stored)
    }
  } catch {
    // Erreur de parsing, retourner les données par défaut
  }
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

function App() {
  const [view, setView] = useState<AppView>(() => {
    try {
      const stored = localStorage.getItem('vizion:view')
      return (stored as AppView) || 'saison'
    } catch {
      return 'saison'
    }
  })
  const [events, setEvents] = useState<EventItem[]>(loadEventsFromStorage)
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

    setEvents((prev) => {
      const nextEvent: EventItem = {
        id: `event-${Date.now()}`,
        name: cleanName,
        country: 'Publiée',
        startLabel: 'À définir',
        imageUrl,
        courses: [],
      }
      return [nextEvent, ...prev]
    })
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
    const fallbackEventId = selectedEventId ?? events[0]?.id ?? `event-${Date.now()}`
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

    setEvents((prev) => {
      const targetEventId = fallbackEventId
      const nextCourse: CourseItem = {
        id: `course-${Date.now()}`,
        name: cleanName,
        imageUrl,
        gpxName: payload.gpxName,
        gpxSvg,
        distanceKm: payload.distanceKm,
        elevationGain: payload.elevationGain,
        profile: payload.profile,
      }

      if (!prev.find((event) => event.id === targetEventId)) {
        return [
          {
            id: targetEventId,
            name: 'Sans titre',
            country: 'Publiée',
            startLabel: 'À définir',
            imageUrl,
            courses: [nextCourse],
          },
        ]
      }

      return prev.map((event) =>
        event.id === targetEventId
          ? {
              ...event,
              courses: [nextCourse, ...event.courses],
            }
          : event,
      )
    })
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

  // Sauvegarder les events dans localStorage à chaque modification
  useEffect(() => {
    try {
      localStorage.setItem('vizion:events', JSON.stringify(events))
    } catch (error) {
      // Erreur de stockage (peut être due à la limite de taille de localStorage)
      console.warn('Impossible de sauvegarder les events dans localStorage', error)
    }
  }, [events])

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
