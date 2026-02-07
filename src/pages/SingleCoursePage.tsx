import './SingleCoursePage.css'

import { FiAlertCircle, FiZap, FiChevronRight, FiMapPin, FiSun, FiClock, FiWind, FiRefreshCw } from 'react-icons/fi'
import gpxIcon from '../assets/d824ad10b22406bc6f779da5180da5cdaeca1e2c.svg'
import HeaderTopBar from '../components/HeaderTopBar'
import SideNav from '../components/SideNav'
import SingleCourseElevationChart from '../components/SingleCourseElevationChart'
import SimulationEngine from '../components/SimulationEngine'
import WindVectorChart from '../components/WindVectorChart'
import React, { useEffect, useRef, useState } from 'react'

/** ID Strava de l'activité du 1er finisher (Diagonale des fous) pour embed + temps au km */
const FIRST_FINISHER_ACTIVITY_ID = '16387493791'

/** Étapes du guide course (style TrackTitan) — Segment entre Description et Ma préparation */
const COURSE_STEPS = [
  { id: 'description', label: 'Description' },
  { id: 'segment', label: 'Segment' },
  { id: 'ma-preparation', label: 'Ma préparation' },
] as const
export type CourseStepId = (typeof COURSE_STEPS)[number]['id']
import useGpxHoverMarker from '../hooks/useGpxHoverMarker'
import useStravaMetrics from '../hooks/useStravaMetrics'
import { analyzeCourseReadiness } from '../lib/courseAnalysis'
import { mergeMetricsWithFit, mergeMetricsWithFitList } from '../lib/fitMetricsMerge'
import { getCurrentUser } from '../lib/auth'
import { getUserFitActivities, saveUserFitActivity, type UserFitActivityRow } from '../lib/userFitActivities'
import { grandRaidStats } from '../data/grandRaidStats'
import { getWeather, getCityFromCoords } from '../lib/xweather'
import { analyzeProfileZones } from '../lib/profileAnalysis'
import { segmentSvgIntoNumberedSegments, addSvgTooltips, addSvgSegmentClickListeners, getSvgZoomedOnSegment, getSegmentSvgWithElevation, type SegmentClickPayload } from '../lib/svgZoneSegmenter'
import { latLonToSvg, type GpxBounds } from '../lib/gpxToSvg'
import FitParser from 'fit-file-parser'

/** Extrait le viewBox d’une chaîne SVG (pour superposer les gouttes de pluie). */
function parseViewBox(svgString: string): string | null {
  const m = svgString.match(/viewBox=["']([^"']+)["']/)
  return m ? m[1].trim() : null
}

/** Path goutte d’eau (centrée 0,0), pointe en bas */
const DROP_PATH = 'M0 -2.2 C1.2 -2.2 2.2 -1.2 2.2 0 C2.2 1.5 0 3.5 0 3.5 S-2.2 1.5 -2.2 0 C-2.2 -1.2 -1.2 -2.2 0 -2.2 Z'

/** Résumé extrait d'un fichier .fit parsé (première session) */
export type FitActivitySummary = {
  distanceKm: number | null
  durationSec: number | null
  ascentM: number | null
  sport: string | null
}

/** Extrait un résumé lisible depuis le résultat de fit-file-parser (mode cascade). */
function getFitSummary(data: { sessions?: Array<{ [k: string]: unknown }>; activity?: { sessions?: Array<{ [k: string]: unknown }>; laps?: Array<{ [k: string]: unknown }> }; laps?: Array<{ [k: string]: unknown }>; records?: Array<{ [k: string]: unknown }> }): FitActivitySummary | null {
  const sessions = data.sessions ?? data.activity?.sessions
  const session = sessions?.[0] as { [k: string]: unknown } | undefined
  if (!session) {
    const lap = data.laps?.[0] ?? data.activity?.laps?.[0] as { [k: string]: unknown } | undefined
    if (lap) {
      const rawDist = lap.total_distance as number | undefined
      const rawTime = lap.total_elapsed_time as number | undefined
      const rawAscent = lap.total_ascent as number | undefined
      const distanceKm = rawDist != null ? (rawDist > 1000 ? rawDist / 1000 : rawDist) : null
      const durationSec = rawTime != null ? (rawTime > 1e6 ? Math.round(rawTime / 1000) : rawTime) : null
      const ascentM = rawAscent != null ? rawAscent : null
      const sport = (lap.sport as string) ?? null
      return { distanceKm, durationSec, ascentM, sport }
    }
    return null
  }
  const rawDist = session.total_distance as number | undefined
  const rawTime = session.total_elapsed_time as number | undefined
  const rawAscent = session.total_ascent as number | undefined
  const distanceKm = rawDist != null ? (rawDist > 1000 ? rawDist / 1000 : rawDist) : null
  const durationSec = rawTime != null ? (rawTime > 1e6 ? Math.round(rawTime / 1000) : rawTime) : null
  const ascentM = rawAscent != null ? rawAscent : null
  const sport = (session.sport as string) ?? null
  return { distanceKm, durationSec, ascentM, sport }
}

/** Formate une durée en secondes en "Xh Ymin". */
function formatDuration(sec: number): string {
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  if (h > 0) return `${h}h ${m}min`
  return `${m} min`
}

/** Directions cardinales (API) → degrés (0 = N, 90 = E) */
const WIND_DIR_DEG: Record<string, number> = {
  N: 0, NNE: 22.5, NE: 45, ENE: 67.5, E: 90, ESE: 112.5, SE: 135, SSE: 157.5,
  S: 180, SSW: 202.5, SW: 225, WSW: 247.5, W: 270, WNW: 292.5, NW: 315, NNW: 337.5,
}

/** Ligne météo/heure avec icônes (lieu, température, heure, vent) */
function CourseMetaRegion({
  regionCity,
  weatherTemp,
  regionTime,
  regionOffsetHours,
  windDir,
  windSpeedKmh,
}: {
  regionCity: string | null
  weatherTemp: number | null
  regionTime: string | null
  regionOffsetHours: number | null
  windDir: string | null
  windSpeedKmh: number | null
}) {
  const timeStr =
    regionOffsetHours != null
      ? (() => {
          const now = Date.now()
          const regionMs = now + regionOffsetHours * 60 * 60 * 1000
          const d = new Date(regionMs)
          const h = d.getUTCHours()
          const m = d.getUTCMinutes()
          const time = `${h.toString().padStart(2, '0')}h${m.toString().padStart(2, '0')}`
          const userOffsetHours = -new Date().getTimezoneOffset() / 60
          const diffHours = Math.round((regionOffsetHours - userOffsetHours) * 100) / 100
          const diffStr = diffHours === 0 ? '0h' : `${diffHours >= 0 ? '+' : ''}${diffHours}h`
          return `${time} (${diffStr})`
        })()
      : regionTime
  const windStr =
    windDir != null || windSpeedKmh != null
      ? [windDir, windSpeedKmh != null ? `${Math.round(windSpeedKmh)} km/h` : null].filter(Boolean).join(' ')
      : null
  const items: { icon: React.ReactNode; text: string }[] = []
  if (regionCity != null) items.push({ icon: <FiMapPin aria-hidden />, text: regionCity })
  if (weatherTemp != null) items.push({ icon: <FiSun aria-hidden />, text: `${Math.round(weatherTemp)}°` })
  if (timeStr != null) items.push({ icon: <FiClock aria-hidden />, text: timeStr })
  if (windStr != null) items.push({ icon: <FiWind aria-hidden />, text: windStr })
  if (items.length === 0) return null
  return (
    <p className="single-course-course__meta-region" aria-label="Météo et heure de la région">
      {items.map(({ icon, text }, i) => (
        <span key={i} className="single-course-course__meta-region-item">
          {i > 0 && <span className="single-course-course__meta-region-sep" aria-hidden> · </span>}
          {icon}
          <span>{text}</span>
        </span>
      ))}
    </p>
  )
}

/** Pastille vent affichée sur le tracé GPX (direction + vitesse) */
function WindBadge({ windDir, windSpeedKmh }: { windDir: string | null; windSpeedKmh: number | null }) {
  if (windDir == null && windSpeedKmh == null) return null
  const deg = (windDir != null ? WIND_DIR_DEG[windDir] : undefined) ?? 0
  const label = [windDir, windSpeedKmh != null ? `${Math.round(windSpeedKmh)} km/h` : null].filter(Boolean).join(' ')
  return (
    <div className="single-course-course__gpx-wind-badge" aria-label={`Vent ${label}`}>
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
        <path d="M12 4v16M12 4l3 5H9l3-5z" transform={`rotate(${deg} 12 12)`} />
      </svg>
      <span>{label}</span>
    </div>
  )
}

type SingleCoursePageProps = {
  onNavigate?: (view: 'saison' | 'events' | 'courses' | 'course' | 'account') => void
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
      startCoordinates?: [number, number]
      weatherSamplePoints?: Array<[number, number]>
      gpxBounds?: GpxBounds
    }>
  }>
  selectedCourseId: string | null
}

export default function SingleCoursePage({
  onNavigate,
  events,
  selectedCourseId,
}: SingleCoursePageProps) {
  const selectedCourse =
    events
      .flatMap((event) => event.courses.map((course) => ({ ...course, eventName: event.name })))
      .find((course) => course.id === selectedCourseId) ?? events[0]?.courses[0]

  const courseTitle = selectedCourse?.name ?? 'Course'
  const courseEventName = (selectedCourse as { eventName?: string } | undefined)?.eventName ?? 'Grand Raid'
  const courseStats =
    selectedCourse?.distanceKm && selectedCourse?.elevationGain
      ? `${selectedCourse.distanceKm.toFixed(0)} km · ${Math.round(selectedCourse.elevationGain)} D+`
      : '175 km · 10 150 D+ · Août 2026'
  const courseHeading = `${courseEventName.toUpperCase()} – ${courseTitle}`
  const rawProfile = (selectedCourse as { profile?: Array<[number, number]> | string } | undefined)?.profile
  // Parser le profile si c'est une string JSON, sinon utiliser directement
  let profileData: Array<[number, number]> | undefined = undefined
  if (rawProfile) {
    if (typeof rawProfile === 'string') {
      try {
        // Le profile peut être une string JSON double-encodée
        const parsed = JSON.parse(rawProfile)
        if (typeof parsed === 'string') {
          profileData = JSON.parse(parsed)
        } else if (Array.isArray(parsed)) {
          profileData = parsed
        }
      } catch {
        profileData = undefined
      }
    } else if (Array.isArray(rawProfile) && rawProfile.length > 0) {
      profileData = rawProfile
    }
  }
  const gpxSvg = selectedCourse?.gpxSvg
  const maxDistance = profileData?.length ? profileData[profileData.length - 1][0] : undefined
  const { metrics } = useStravaMetrics()
  /** Étape courante du guide (Description | Ma préparation) */
  const [currentStep, setCurrentStep] = useState<CourseStepId>('description')
  const [segmentedSvg, setSegmentedSvg] = useState<string | null>(null)
  const [selectedSegment, setSelectedSegment] = useState<SegmentClickPayload | null>(null)
  /** Vue 3D (perspective) du tracé GPX sur la page Segment */
  const [segmentView3D, setSegmentView3D] = useState(false)
  const segmentStartKm =
    currentStep === 'segment' && selectedSegment != null ? selectedSegment.startKm : undefined
  useGpxHoverMarker('gpx-inline-svg', maxDistance, segmentStartKm)
  const [weatherTemp, setWeatherTemp] = useState<number | null>(null)
  const [rainLast24h, setRainLast24h] = useState<boolean | null>(null)
  const [windSpeedKmh, setWindSpeedKmh] = useState<number | null>(null)
  const [windDir, setWindDir] = useState<string | null>(null)
  const [regionCity, setRegionCity] = useState<string | null>(null)
  const [regionTime, setRegionTime] = useState<string | null>(null)
  const [regionOffsetHours, setRegionOffsetHours] = useState<number | null>(null)
  /** Pluie par point échantillon le long du tracé (pour afficher les gouttes sur le GPX) */
  const [rainAlongRoute, setRainAlongRoute] = useState<Array<{ lat: number; lon: number; rain: boolean }> | null>(null)
  /** Temps au km du 1er finisher (activité Strava) — pour la Diagonale des fous */
  const [firstFinisherSplits, setFirstFinisherSplits] = useState<Array<{ km: number; movingTimeSec: number; elapsedTimeSec: number; paceMinPerKm?: number }> | null>(null)
  const [firstFinisherLoading, setFirstFinisherLoading] = useState(false)
  const [firstFinisherError, setFirstFinisherError] = useState<string | null>(null)
  /** Ajustements recommandés cochés (persistés en localStorage par course) */
  const [preparationCheckedActions, setPreparationCheckedActions] = useState<Record<string, boolean>>({})
  /** Fichier .fit importé sur la page Ma préparation */
  const [fitFileName, setFitFileName] = useState<string | null>(null)
  const [fitParsedData, setFitParsedData] = useState<FitActivitySummary | null>(null)
  const [fitParseError, setFitParseError] = useState<string | null>(null)
  const [fitParseLoading, setFitParseLoading] = useState(false)
  const fitFileInputRef = useRef<HTMLInputElement | null>(null)
  /** Utilisateur connecté (Trackali) et ses activités .fit sauvegardées */
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [userFitActivities, setUserFitActivities] = useState<UserFitActivityRow[]>([])
  /** Contenu Ma préparation généré par l'IA (une fois, cache 7 jours) */
  const [aiContent, setAiContent] = useState<{
    summary: string
    coachVerdict: string
    stateSublabel: string
    next4WeeksSummary: string
    immediateActions: string[]
    secondaryActions: string[]
    projectionIfContinues: string
    projectionIfFollows: string
    segmentIntro?: string
  } | null>(null)
  const [aiContentLoading, setAiContentLoading] = useState(false)
  const [aiContentError, setAiContentError] = useState<string | null>(null)
  const [aiContentGeneratedAt, setAiContentGeneratedAt] = useState<number | null>(null)

  const startCoords = (selectedCourse as { startCoordinates?: [number, number] } | undefined)?.startCoordinates
  const courseId = (selectedCourse as { id?: string } | undefined)?.id ?? ''
  const preparationStorageKey = `vizion_preparation_actions_${selectedCourseId ?? ''}`
  const fitStorageKey = `vizion_fit_${selectedCourseId ?? ''}`

  useEffect(() => {
    if (!preparationStorageKey) return
    try {
      const raw = localStorage.getItem(preparationStorageKey)
      if (raw) {
        const parsed = JSON.parse(raw) as Record<string, boolean>
        setPreparationCheckedActions(parsed)
      } else {
        setPreparationCheckedActions({})
      }
    } catch {
      setPreparationCheckedActions({})
    }
  }, [preparationStorageKey])

  // Restaurer le dernier .fit importé pour cette course (localStorage)
  useEffect(() => {
    if (!fitStorageKey) return
    try {
      const raw = localStorage.getItem(fitStorageKey)
      if (raw) {
        const stored = JSON.parse(raw) as { summary: FitActivitySummary; fileName?: string }
        if (stored.summary && typeof stored.summary === 'object') {
          setFitParsedData(stored.summary)
          if (stored.fileName) setFitFileName(stored.fileName)
        }
      } else {
        setFitParsedData(null)
        setFitFileName(null)
      }
    } catch {
      setFitParsedData(null)
      setFitFileName(null)
    }
  }, [fitStorageKey])

  // Charger l'utilisateur Trackali et ses activités .fit (pour analyse sur les 5 plus longues)
  const FIT_TOP5_STORAGE_KEY = 'vizion_user_fit_top5'
  const loadUserFitActivities = (userId: string) => {
    getUserFitActivities(userId).then((rows) => {
      setUserFitActivities(rows)
      try {
        const top5 = rows.slice(0, 5).map((r) => r.summary)
        if (top5.length > 0) {
          localStorage.setItem(FIT_TOP5_STORAGE_KEY, JSON.stringify(top5))
        }
      } catch {
        // ignore
      }
    })
  }
  useEffect(() => {
    let mounted = true
    getCurrentUser().then((user) => {
      if (!mounted) return
      if (user?.id) {
        setCurrentUserId(user.id)
        loadUserFitActivities(user.id)
      } else {
        setCurrentUserId(null)
        setUserFitActivities([])
      }
    })
    return () => { mounted = false }
  }, [])
  // Recharger les .fit quand on affiche Ma préparation et que la liste est vide (évite race condition)
  useEffect(() => {
    if (currentStep !== 'ma-preparation' || !currentUserId) return
    if (userFitActivities.length > 0) return
    loadUserFitActivities(currentUserId)
  }, [currentStep, currentUserId, userFitActivities.length])

  const togglePreparationAction = (actionText: string) => {
    setPreparationCheckedActions((prev) => {
      const next = { ...prev, [actionText]: !prev[actionText] }
      try {
        localStorage.setItem(preparationStorageKey, JSON.stringify(next))
      } catch {}
      return next
    })
  }

  const isReunionCourse =
    courseId === 'example-grand-raid-course' ||
    /grand raid|réunion|reunion|diagonale/i.test(courseEventName)
  const regionCoords: [number, number] | undefined = isReunionCourse
    ? [-21.01, 55.27]
    : startCoords?.length === 2
      ? startCoords
      : undefined
  const startCoordsKey = regionCoords ? `${regionCoords[0]},${regionCoords[1]}` : ''
  const weatherSamplePoints = (selectedCourse as { weatherSamplePoints?: Array<[number, number]> } | undefined)?.weatherSamplePoints
  const gpxBounds = (selectedCourse as { gpxBounds?: GpxBounds } | undefined)?.gpxBounds

  // Météo par point le long du tracé (pour gouttes sur le GPX)
  useEffect(() => {
    const points = (selectedCourse as { weatherSamplePoints?: Array<[number, number]> } | undefined)?.weatherSamplePoints
    const bounds = (selectedCourse as { gpxBounds?: GpxBounds } | undefined)?.gpxBounds
    if (!points?.length || !bounds) {
      setRainAlongRoute(null)
      return
    }
    let cancelled = false
    Promise.all(
      points.map(([lat, lon]) =>
        getWeather(lat, lon).then((w) => ({ lat, lon, rain: w?.rainLast24h === true }))
      )
    ).then((results) => {
      if (cancelled) return
      // À titre d'exemple : forcer des gouttes pour voir le rendu (démo)
      const withDemoDrops = results.map((p, i) => {
        const step = Math.max(1, Math.floor(results.length / 4))
        const showDrop = p.rain || i % step === 0 || i === results.length - 1
        return { ...p, rain: showDrop }
      })
      setRainAlongRoute(withDemoDrops)
    })
    return () => { cancelled = true }
  }, [selectedCourseId, !!gpxBounds, weatherSamplePoints?.length ?? 0])

  // Météo, lieu, heure et pluie 24h de la région de la course (cache 4h pour météo/ville)
  useEffect(() => {
    if (!regionCoords || regionCoords.length < 2) {
      setWeatherTemp(null)
      setRainLast24h(null)
      setWindSpeedKmh(null)
      setWindDir(null)
      setRegionCity(null)
      setRegionTime(null)
      setRegionOffsetHours(null)
      return
    }
    let cancelled = false
    const [lat, lon] = regionCoords
    const base = typeof window !== 'undefined' ? window.location.origin : ''
    Promise.all([
      getWeather(lat, lon),
      getCityFromCoords(lat, lon),
      fetch(`${base}/api/timezone?lat=${lat}&lon=${lon}`).then((r) => (r.ok ? r.json() : null)).catch(() => null),
    ])
      .then(([weather, city, tz]) => {
        if (cancelled) return
        setWeatherTemp(weather?.tempC ?? null)
        setRainLast24h(weather?.rainLast24h ?? true)
        const hasRealWind = weather?.windDir != null || weather?.windSpeedKmh != null
        setWindSpeedKmh(weather?.windSpeedKmh ?? (hasRealWind ? null : 12))
        setWindDir(weather?.windDir ?? (hasRealWind ? null : 'NNE'))
        setRegionCity(city ?? null)
        setRegionTime(tz?.time ?? null)
        setRegionOffsetHours(typeof tz?.offsetHours === 'number' ? tz.offsetHours : null)
      })
      .catch(() => {
        if (!cancelled) {
          setWeatherTemp(null)
          setRainLast24h(true)
          setWindSpeedKmh(12)
          setWindDir('NNE')
        }
      })
    return () => { cancelled = true }
  }, [selectedCourseId, startCoordsKey])

  // Mise à jour de l'heure de la région toutes les minutes
  useEffect(() => {
    if (!regionCoords || regionCoords.length < 2) return
    const id = setInterval(() => {
      const base = typeof window !== 'undefined' ? window.location.origin : ''
      const [lat, lon] = regionCoords
      fetch(`${base}/api/timezone?lat=${lat}&lon=${lon}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((tz) => {
          if (tz) {
            setRegionTime(tz.time)
            if (typeof tz.offsetHours === 'number') setRegionOffsetHours(tz.offsetHours)
          }
        })
    }, 60 * 1000)
    return () => clearInterval(id)
  }, [selectedCourseId, startCoordsKey])

  // Charger le script Strava embed (une fois)
  useEffect(() => {
    if (typeof document === 'undefined') return
    if (document.querySelector('script[src="https://strava-embeds.com/embed.js"]')) return
    const script = document.createElement('script')
    script.src = 'https://strava-embeds.com/embed.js'
    script.async = true
    document.body.appendChild(script)
  }, [])

  // Récupérer les temps au km du 1er finisher (Diagonale des fous) via l'API Strava
  useEffect(() => {
    const isExample = (selectedCourse as { id?: string } | undefined)?.id === 'example-grand-raid-course'
    if (!isExample) {
      setFirstFinisherSplits(null)
      setFirstFinisherError(null)
      return
    }
    let token: string | null = null
    try {
      const raw = localStorage.getItem('trackali:strava_token')
      if (raw) token = (JSON.parse(raw) as { access_token?: string })?.access_token ?? null
    } catch {
      token = null
    }
    if (!token) {
      setFirstFinisherSplits(null)
      setFirstFinisherError(null)
      return
    }
    setFirstFinisherLoading(true)
    setFirstFinisherError(null)
    const base = typeof window !== 'undefined' ? window.location.origin : ''
    fetch(`${base}/api/strava/activity-details?activity_id=${FIRST_FINISHER_ACTIVITY_ID}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => {
        if (!r.ok) throw new Error(r.status === 401 ? 'Non connecté à Strava' : `Erreur ${r.status}`)
        return r.json()
      })
      .then((data) => {
        setFirstFinisherSplits(data.splits_per_km || null)
      })
      .catch((err) => {
        setFirstFinisherSplits(null)
        setFirstFinisherError(err instanceof Error ? err.message : 'Impossible de charger les temps')
      })
      .finally(() => setFirstFinisherLoading(false))
  }, [selectedCourseId])

  // Analyser la préparation pour cette course
  const courseData = selectedCourse?.distanceKm && selectedCourse?.elevationGain
    ? {
        distanceKm: selectedCourse.distanceKm,
        elevationGain: selectedCourse.elevationGain,
        name: selectedCourse.name,
        temperature: weatherTemp ?? undefined,
      }
    : {
        distanceKm: 175,
        elevationGain: 10150,
        name: 'Grand Raid',
        temperature: weatherTemp ?? undefined,
      }

  // Récupérer les segments Strava de la course
  const stravaSegments = (selectedCourse as { stravaSegments?: Array<{
    id: number
    name: string
    distance: number
    elevation_gain: number
    average_grade: number
    type: 'climb' | 'descent' | 'flat'
  }> } | undefined)?.stravaSegments

  // Utiliser les stats du Grand Raid si c'est une course similaire
  const useGrandRaidStats = courseData.name?.toLowerCase().includes('grand raid') || 
                            courseData.name?.toLowerCase().includes('diagonale') ||
                            (courseData.distanceKm > 150 && courseData.elevationGain > 8000)

const userFitTop5 = userFitActivities.slice(0, 5).map((r) => r.summary)
  const fitTop5FromStorage = ((): FitActivitySummary[] => {
    if (userFitTop5.length > 0) return []
    try {
      const raw = typeof window !== 'undefined' ? localStorage.getItem('vizion_user_fit_top5') : null
      if (!raw) return []
      const parsed = JSON.parse(raw) as FitActivitySummary[]
      return Array.isArray(parsed) ? parsed.slice(0, 5) : []
    } catch {
      return []
    }
  })()
  const effectiveFitTop5 = userFitTop5.length > 0 ? userFitTop5 : fitTop5FromStorage
  const fitSignature = effectiveFitTop5.map((s) => `${s.distanceKm ?? 0}_${s.ascentM ?? 0}`).join('|').slice(0, 80)
  const metricsForAnalysis = effectiveFitTop5.length > 0
    ? mergeMetricsWithFitList(metrics, effectiveFitTop5)
    : mergeMetricsWithFit(metrics, fitParsedData)
  const analysis = analyzeCourseReadiness(
    metricsForAnalysis,
    courseData,
    stravaSegments,
    useGrandRaidStats ? grandRaidStats : undefined
  )

  // Analyser les zones du profil
  const profileZones = profileData && metrics
    ? analyzeProfileZones(profileData, metrics, courseData.distanceKm, courseData.elevationGain)
    : []

  // Réinitialiser le segment sélectionné quand on change de course
  useEffect(() => {
    setSelectedSegment(null)
  }, [selectedCourseId])

  const AI_CONTENT_CACHE_PREFIX = 'vizion_prep_ai_'
  const AI_CONTENT_TTL_MS = 7 * 24 * 60 * 60 * 1000 // 7 jours

  // Charger le contenu Ma préparation par l'IA (une fois, cache 7 jours)
  useEffect(() => {
    if (currentStep !== 'ma-preparation' || !courseData) return
    const cacheKey = `${AI_CONTENT_CACHE_PREFIX}${courseId}_${courseData.distanceKm}_${courseData.elevationGain}_${effectiveFitTop5.length}_${fitSignature}`
    const cached = (() => {
      try {
        const raw = typeof window !== 'undefined' ? localStorage.getItem(cacheKey) : null
        if (!raw) return null
        const { generatedAt, content } = JSON.parse(raw) as { generatedAt: number; content: typeof aiContent }
        if (Date.now() - generatedAt < AI_CONTENT_TTL_MS && content) return { content, generatedAt }
        return null
      } catch {
        return null
      }
    })()
    if (cached) {
      setAiContent(cached.content)
      setAiContentGeneratedAt(cached.generatedAt)
      setAiContentError(null)
      return
    }
    let cancelled = false
    setAiContentLoading(true)
    setAiContentError(null)
    const fitPayload = effectiveFitTop5.map((s, i) => ({
      distanceKm: s.distanceKm ?? null,
      durationSec: s.durationSec ?? null,
      ascentM: s.ascentM ?? null,
      fileName: userFitActivities[i]?.file_name ?? null,
    }))
    const base = typeof window !== 'undefined' ? window.location.origin : ''
    fetch(`${base}/api/preparation/content`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        course: { distanceKm: courseData.distanceKm, elevationGain: courseData.elevationGain, name: courseData.name },
        fitActivities: fitPayload,
        metricsSummary: analysis?.summary ?? null,
        readiness: analysis?.readiness ?? null,
        next4WeeksGoals: analysis?.next4WeeksGoals ?? null,
      }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return
        if (data.error) {
          setAiContentError(data.message || data.error)
          setAiContent(null)
        } else {
          const content = {
            summary: data.summary ?? '',
            coachVerdict: data.coachVerdict ?? '',
            stateSublabel: data.stateSublabel ?? '',
            next4WeeksSummary: data.next4WeeksSummary ?? '',
            immediateActions: Array.isArray(data.immediateActions) ? data.immediateActions : [],
            secondaryActions: Array.isArray(data.secondaryActions) ? data.secondaryActions : [],
            projectionIfContinues: data.projectionIfContinues ?? '',
            projectionIfFollows: data.projectionIfFollows ?? '',
            segmentIntro: data.segmentIntro,
          }
          setAiContent(content)
          setAiContentGeneratedAt(Date.now())
          setAiContentError(null)
          try {
            localStorage.setItem(cacheKey, JSON.stringify({ generatedAt: Date.now(), content }))
          } catch {
            // ignore
          }
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setAiContentError(err?.message ?? 'Erreur réseau')
          setAiContent(null)
        }
      })
      .finally(() => {
        if (!cancelled) setAiContentLoading(false)
      })
    return () => { cancelled = true }
  }, [currentStep, courseId, courseData?.distanceKm, courseData?.elevationGain, courseData?.name, effectiveFitTop5.length, fitSignature])

  // Segmenter le SVG : segments numérotés (1, 2, 3...) + clic pour sélectionner
  useEffect(() => {
    let cleanupTooltips: (() => void) | undefined
    let cleanupClicks: (() => void) | undefined

    if (gpxSvg && profileData && profileData.length > 0) {
      const totalKm = profileData[profileData.length - 1]?.[0] ?? 0
      const numSegments = Math.max(5, Math.min(15, Math.round(totalKm / 15)))
      const segmented = segmentSvgIntoNumberedSegments(gpxSvg, profileData, numSegments)
      setSegmentedSvg(segmented)

      const timer = setTimeout(() => {
        cleanupTooltips = addSvgTooltips('gpx-inline-svg')
        cleanupClicks = addSvgSegmentClickListeners('gpx-inline-svg', (payload) => {
          setSelectedSegment(payload)
          setCurrentStep('segment')
        })
      }, 200)

      return () => {
        clearTimeout(timer)
        if (cleanupTooltips) cleanupTooltips()
        if (cleanupClicks) cleanupClicks()
      }
    } else {
      setSegmentedSvg(gpxSvg || null)
    }
  }, [gpxSvg, profileZones, profileData])

  /** Paragraphe dynamique "Quel est un bon temps..." (style Track Titan, adapté trail) */
  const goodTimeParagraph = (() => {
    const courseLabel = courseTitle || courseData.name || 'cette course'
    const distanceLabel = `${courseData.distanceKm} km`
    const dPlusLabel = `${Math.round(courseData.elevationGain)} m D+`
    if (useGrandRaidStats && grandRaidStats) {
      const { finisherTimes } = grandRaidStats
      const bestTime = `${finisherTimes.min} h`
      const topPercentTime = `${finisherTimes.min + 2}–${finisherTimes.min + 4} h`
      const finishInTime = '48–52 h'
      const userEstimate = analysis?.timeEstimate?.rangeFormatted
      return {
        intro: `Quel est un bon temps pour ${courseLabel} (${distanceLabel}, ${dPlusLabel}) ?`,
        best: `Le meilleur temps enregistré sur cette course (données Grand Raid) est d'environ ${bestTime}.`,
        elite: `Les trailers les plus rapides (top 5 %) réalisent un temps d'environ ${topPercentTime}. Ce sont en général ceux qui visent le podium et les premières places.`,
        average: `Si vous débutez sur ce type d'épreuve ou si votre objectif est simplement de terminer, visez un temps autour de ${finishInTime}.`,
        cta: userEstimate
          ? `Votre temps estimé avec Trackali est de ${userEstimate}. Vous pouvez affiner cette fourchette avec le simulateur et comparer votre préparation aux recommandations.`
          : "Où que vous en soyez dans votre préparation, vous pouvez utiliser le simulateur Trackali pour estimer votre temps et comparer votre charge d'entraînement aux objectifs recommandés.",
      }
    }
    const userEstimate = analysis?.timeEstimate?.rangeFormatted
    return {
      intro: `Quel est un bon temps pour ${courseLabel} (${distanceLabel}, ${dPlusLabel}) ?`,
      best: null,
      elite: `Pour une course de cette distance et ce dénivelé, les temps varient fortement selon le niveau et les conditions.`,
      average: `Si votre objectif est de terminer dans les délais, prévoyez une fourchette réaliste selon votre expérience et votre entraînement.`,
      cta: userEstimate
        ? `Votre temps estimé avec Trackali est de ${userEstimate}. Affinez-le avec le simulateur ci-dessous.`
        : 'Utilisez le simulateur Trackali pour estimer votre temps et comparer votre préparation aux objectifs de la course.',
    }
  })()

  /** Liste des segments (même découpage que le tracé) pour les cartes segment */
  const segmentBoundsList = (() => {
    if (!profileData || profileData.length === 0) return []
    const totalKm = profileData[profileData.length - 1]?.[0] ?? 0
    const numSegments = Math.max(5, Math.min(15, Math.round(totalKm / 15)))
    const list: { segmentNumber: number; startKm: number; endKm: number }[] = []
    for (let i = 0; i < numSegments; i++) {
      list.push({
        segmentNumber: i + 1,
        startKm: (i * totalKm) / numSegments,
        endKm: ((i + 1) * totalKm) / numSegments,
      })
    }
    return list
  })()

  /** Extrait le profil pour un segment (distance rebasée à 0) pour le graphique */
  function getSegmentProfile(startKm: number, endKm: number): Array<[number, number]> {
    if (!profileData || profileData.length === 0) return []
    const points = profileData.filter(([d]) => d >= startKm - 0.01 && d <= endKm + 0.01)
    if (points.length < 2) return []
    return points.map(([d, e]) => [Number((d - startKm).toFixed(2)), e])
  }

  /** Stats d’un segment (D+, D-, pente moyenne) — style Track Titan sous la carte */
  function getSegmentStats(startKm: number, endKm: number): {
    distanceKm: number
    elevationGain: number
    elevationLoss: number
    averageGradePercent: number
  } | null {
    if (!profileData || profileData.length === 0) return null
    const points = profileData.filter(([d]) => d >= startKm - 0.01 && d <= endKm + 0.01)
    if (points.length < 2) return null
    let elevationGain = 0
    let elevationLoss = 0
    for (let i = 1; i < points.length; i++) {
      const diff = points[i][1] - points[i - 1][1]
      if (diff > 0) elevationGain += diff
      else elevationLoss += -diff
    }
    const distanceKm = endKm - startKm
    const distanceM = distanceKm * 1000
    const averageGradePercent = distanceM > 0 ? (elevationGain / distanceM) * 100 : 0
    return {
      distanceKm,
      elevationGain: Math.round(elevationGain),
      elevationLoss: Math.round(elevationLoss),
      averageGradePercent: Math.round(averageGradePercent * 10) / 10,
    }
  }

  return (
    <div className="single-course-page">
      <HeaderTopBar onNavigate={onNavigate} />

      <div className="single-course-body">
        <aside className="single-course-side">
          <SideNav activeItem="saison" onNavigate={onNavigate} />
        </aside>

        <main className="single-course-main">
          {/* Fil d'Ariane : Courses > [Nom course] > [Étape] */}
          <nav className="single-course-breadcrumb" aria-label="Fil d'Ariane">
            <ol className="single-course-breadcrumb__list">
              <li className="single-course-breadcrumb__item">
                <button
                  type="button"
                  className="single-course-breadcrumb__link"
                  onClick={() => onNavigate?.('courses')}
                >
                  Courses
                </button>
              </li>
              <li className="single-course-breadcrumb__item" aria-hidden>
                <FiChevronRight className="single-course-breadcrumb__sep" aria-hidden />
              </li>
              <li className="single-course-breadcrumb__item">
                <span className="single-course-breadcrumb__current-course">
                  {courseHeading}
                </span>
              </li>
              <li className="single-course-breadcrumb__item" aria-hidden>
                <FiChevronRight className="single-course-breadcrumb__sep" aria-hidden />
              </li>
              <li className="single-course-breadcrumb__item single-course-breadcrumb__steps">
                {COURSE_STEPS.map((step) => (
                  <button
                    key={step.id}
                    type="button"
                    className={`single-course-breadcrumb__step-btn ${currentStep === step.id ? 'single-course-breadcrumb__step-btn--active' : ''}`}
                    onClick={() => setCurrentStep(step.id)}
                  >
                    {step.id === 'segment' && selectedSegment != null
                      ? `Segment ${selectedSegment.segmentNumber}`
                      : step.label}
                  </button>
                ))}
              </li>
            </ol>
          </nav>

          <section className="single-course-heading">
            <div>
              <p className="single-course-title">COURSE</p>
            </div>
          </section>

          {/* Contenu selon l'étape : première étape = Description (deux colonnes) */}
          <section className="single-course-content" data-step={currentStep}>
            {currentStep === 'description' && (
            <>
            <div className="single-course-course">
              <div className="single-course-course__meta">
                <p className="single-course-course__meta-title">{courseHeading}</p>
                <CourseMetaRegion
                  regionCity={regionCity}
                  weatherTemp={weatherTemp}
                  regionTime={regionTime}
                  regionOffsetHours={regionOffsetHours}
                  windDir={windDir}
                  windSpeedKmh={windSpeedKmh}
                />
                <p className="single-course-course__meta-stats">{courseStats}</p>
                {rainLast24h !== null && (
                  <p className="single-course-course__meta-prep" aria-label="État du circuit (pluie 24h)">
                    {rainLast24h
                      ? 'Il a plu dans les dernières 24h sur le circuit.'
                      : 'Circuit sec — pas de pluie dans les dernières 24h.'}
                  </p>
                )}
              </div>
              <div className="single-course-course__gpx single-course-course__gpx--with-overlay">
                {segmentedSvg || gpxSvg ? (
                  <>
                    <div
                      className="single-course-course__gpx-svg"
                      dangerouslySetInnerHTML={{ __html: (segmentedSvg || gpxSvg || '').replace('<svg', '<svg id=\"gpx-inline-svg\"') }}
                    />
                    <WindBadge windDir={windDir} windSpeedKmh={windSpeedKmh} />
                    {(() => {
                      const viewBox = parseViewBox(segmentedSvg || gpxSvg || '')
                      if (!viewBox || !rainAlongRoute?.length || !gpxBounds) return null
                      const rainPositions = rainAlongRoute
                        .filter((p) => p.rain)
                        .map((p) => latLonToSvg(p.lat, p.lon, gpxBounds))
                      if (rainPositions.length === 0) return null
                      return (
                        <svg
                          className="single-course-course__gpx-rain-overlay"
                          viewBox={viewBox}
                          preserveAspectRatio="xMidYMid meet"
                          width="100%"
                          height="100%"
                          aria-hidden
                          style={{ pointerEvents: 'none' }}
                        >
                          <title>Pluie — secteurs où il a plu (24h)</title>
                          <g fill="#3b82f6" stroke="#1d4ed8" strokeWidth="0.35">
                            {rainPositions.map(([x, y], i) => (
                              <path key={i} d={DROP_PATH} transform={`translate(${x},${y}) scale(0.9)`} />
                            ))}
                          </g>
                        </svg>
                      )
                    })()}
                  </>
                ) : (
                  <img src={gpxIcon} alt="GPX" />
                )}
              </div>
              {selectedSegment != null && (
                <p className="single-course-course__segment-selected" aria-live="polite">
                  Segment {selectedSegment.segmentNumber} sélectionné — {selectedSegment.startKm.toFixed(1)} – {selectedSegment.endKm.toFixed(1)} km
                </p>
              )}
              <div className="single-course-course__good-time" role="article" aria-labelledby="good-time-heading">
                <h2 id="good-time-heading" className="single-course-course__good-time-title">
                  {goodTimeParagraph.intro}
                </h2>
                <div className="single-course-course__good-time-body">
                  {goodTimeParagraph.best && <p>{goodTimeParagraph.best}</p>}
                  <p>{goodTimeParagraph.elite}</p>
                  <p>{goodTimeParagraph.average}</p>
                  <p>{goodTimeParagraph.cta}</p>
                </div>
              </div>
              {courseId === 'example-grand-raid-course' && (
                <div className="single-course-course__first-finisher" role="region" aria-labelledby="first-finisher-heading">
                  <h2 id="first-finisher-heading" className="single-course-course__first-finisher-title">1er finisher — Diagonale des fous</h2>
                  <div
                    className="strava-embed-placeholder"
                    data-embed-type="activity"
                    data-embed-id={FIRST_FINISHER_ACTIVITY_ID}
                    data-style="standard"
                    data-from-embed="false"
                  />
                  {(firstFinisherLoading || firstFinisherSplits || firstFinisherError) && (
                    <div className="single-course-course__first-finisher-splits">
                      <p className="single-course-course__first-finisher-splits-title">Temps au km (activité Strava)</p>
                      {firstFinisherLoading && <p className="single-course-course__first-finisher-splits-loading">Chargement…</p>}
                      {firstFinisherError && !firstFinisherLoading && <p className="single-course-course__first-finisher-splits-error">{firstFinisherError}</p>}
                      {firstFinisherSplits && firstFinisherSplits.length > 0 && !firstFinisherLoading && (
                        <div className="single-course-course__splits-table-wrap">
                          <table className="single-course-course__splits-table" aria-label="Temps du 1er finisher par km">
                            <thead>
                              <tr>
                                <th>Km</th>
                                <th>Temps (m:s)</th>
                                <th>Allure (min/km)</th>
                              </tr>
                            </thead>
                            <tbody>
                              {firstFinisherSplits.map((row) => (
                                <tr key={row.km}>
                                  <td>{row.km}</td>
                                  <td>{Math.floor(row.movingTimeSec / 60)}:{(row.movingTimeSec % 60).toString().padStart(2, '0')}</td>
                                  <td>{row.paceMinPerKm != null ? `${Math.floor(row.paceMinPerKm)}:${Math.round((row.paceMinPerKm % 1) * 60).toString().padStart(2, '0')}` : '—'}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
              <div className="single-course-course__card">
                <SingleCourseElevationChart data={profileData} metrics={metrics} />
              </div>
            </div>

            {/* Colonne droite Description : cartes segment avec elevation chart */}
            <div className="single-course-right">
              <div className="single-course-segment-cards">
                {segmentBoundsList.map((seg) => {
                  const segmentProfile = getSegmentProfile(seg.startKm, seg.endKm)
                  const segmentStats = getSegmentStats(seg.startKm, seg.endKm)
                  return (
                    <div
                      key={seg.segmentNumber}
                      role="button"
                      tabIndex={0}
                      className={`single-course-segment-card ${selectedSegment?.segmentNumber === seg.segmentNumber ? 'single-course-segment-card--selected' : ''}`}
                      onClick={() => {
                        setSelectedSegment({
                          segmentIndex: seg.segmentNumber - 1,
                          segmentNumber: seg.segmentNumber,
                          startKm: seg.startKm,
                          endKm: seg.endKm,
                        })
                        setCurrentStep('segment')
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault()
                          setSelectedSegment({
                            segmentIndex: seg.segmentNumber - 1,
                            segmentNumber: seg.segmentNumber,
                            startKm: seg.startKm,
                            endKm: seg.endKm,
                          })
                          setCurrentStep('segment')
                        }
                      }}
                    >
                      <p className="single-course-segment-card__title">
                        Segment {seg.segmentNumber}
                      </p>
                      <p className="single-course-segment-card__km">
                        {seg.startKm.toFixed(1)} – {seg.endKm.toFixed(1)} km
                      </p>
                      <div className="single-course-segment-card__chart">
                        {segmentProfile.length >= 2 ? (
                          <SingleCourseElevationChart data={segmentProfile} metrics={undefined} />
                        ) : (
                          <p className="single-course-segment-card__no-data">Profil non disponible pour ce segment</p>
                        )}
                      </div>
                      {segmentStats != null && (
                        <dl className="single-course-segment-card__stats">
                          <div className="single-course-segment-card__stat">
                            <dt>Longueur</dt>
                            <dd>{segmentStats.distanceKm.toFixed(1)} km</dd>
                          </div>
                          <div className="single-course-segment-card__stat">
                            <dt>D+</dt>
                            <dd>{segmentStats.elevationGain} m</dd>
                          </div>
                          <div className="single-course-segment-card__stat">
                            <dt>D-</dt>
                            <dd>{segmentStats.elevationLoss} m</dd>
                          </div>
                          <div className="single-course-segment-card__stat">
                            <dt>Pente moy.</dt>
                            <dd>{segmentStats.averageGradePercent} %</dd>
                          </div>
                        </dl>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
            </>
            )}

            {currentStep === 'segment' && (
              selectedSegment != null ? (() => {
                const segStats = getSegmentStats(selectedSegment.startKm, selectedSegment.endKm)
                const segmentProfile = getSegmentProfile(selectedSegment.startKm, selectedSegment.endKm)
                const totalKm = maxDistance ?? selectedCourse?.distanceKm ?? 0
                const baseSvg = segmentedSvg || gpxSvg || ''
                const segmentZoomedSvg =
                  totalKm > 0 && baseSvg
                    ? getSvgZoomedOnSegment(
                        baseSvg,
                        selectedSegment.startKm,
                        selectedSegment.endKm,
                        totalKm
                      )
                    : baseSvg
                return (
                  <>
                    <div className="single-course-course single-course-course--segment-view">
                      <div className="single-course-course__meta">
                        <p className="single-course-course__meta-title">
                          {courseHeading} — Segment {selectedSegment.segmentNumber}
                        </p>
                        <CourseMetaRegion
                          regionCity={regionCity}
                          weatherTemp={weatherTemp}
                          regionTime={regionTime}
                          regionOffsetHours={regionOffsetHours}
                          windDir={windDir}
                          windSpeedKmh={windSpeedKmh}
                        />
                        <p className="single-course-course__meta-stats">
                          {selectedSegment.startKm.toFixed(1)} – {selectedSegment.endKm.toFixed(1)} km
                        </p>
                        {rainLast24h !== null && (
                          <p className="single-course-course__meta-prep" aria-label="État du circuit (pluie 24h)">
                            {rainLast24h
                              ? 'Il a plu dans les dernières 24h sur le circuit.'
                              : 'Circuit sec — pas de pluie dans les dernières 24h.'}
                          </p>
                        )}
                      </div>
                      <div className={`single-course-course__gpx single-course-course__gpx--with-overlay ${segmentView3D ? 'single-course-course__gpx--view-3d' : ''}`}>
                        <div className="single-course-course__gpx-toolbar">
                          <button
                            type="button"
                            className="single-course-course__gpx-view-toggle"
                            onClick={() => setSegmentView3D((v) => !v)}
                            aria-pressed={segmentView3D}
                            aria-label={segmentView3D ? 'Passer en vue 2D' : 'Passer en vue 3D'}
                          >
                            {segmentView3D ? 'Vue 2D' : 'Vue 3D'}
                          </button>
                        </div>
                        <WindBadge windDir={windDir} windSpeedKmh={windSpeedKmh} />
                        {segmentView3D ? (
                          (() => {
                            const baseSvg = segmentedSvg || gpxSvg || ''
                            const svgWithElevation =
                              baseSvg && segmentProfile.length >= 2
                                ? getSegmentSvgWithElevation(
                                    baseSvg,
                                    selectedSegment.startKm,
                                    selectedSegment.endKm,
                                    totalKm,
                                    segmentProfile,
                                    { strokeColor: '#bfc900', elevationScale: 1.2 }
                                  )
                                : ''
                            const svgToShow = svgWithElevation.startsWith('<?xml') ? svgWithElevation : segmentZoomedSvg
                            const viewBox3D = svgToShow ? parseViewBox(svgToShow) : null
                            const rainOverlay3D =
                              viewBox3D && rainAlongRoute?.length && gpxBounds
                                ? (() => {
                                    const allRain = rainAlongRoute
                                      .filter((p) => p.rain)
                                      .map((p) => latLonToSvg(p.lat, p.lon, gpxBounds))
                                    if (allRain.length === 0) return null
                                    const parts = viewBox3D.trim().split(/\s+/).map(Number)
                                    const minX = parts[0]; const minY = parts[1]; const w = parts[2]; const h = parts[3]
                                    const inSegment = parts.length === 4 && !parts.some(Number.isNaN)
                                      ? allRain.filter(([x, y]) => x >= minX && x <= minX + w && y >= minY && y <= minY + h)
                                      : allRain
                                    const rainPositions = inSegment.length > 0 ? inSegment : [[minX + w / 2, minY + h / 2]]
                                    return (
                                      <svg
                                        className="single-course-course__gpx-rain-overlay"
                                        viewBox={viewBox3D}
                                        preserveAspectRatio="xMidYMid meet"
                                        width="100%"
                                        height="100%"
                                        aria-hidden
                                        style={{ pointerEvents: 'none' }}
                                      >
                                        <title>Pluie (secteurs où il a plu)</title>
                                        <g fill="#3b82f6" stroke="#1d4ed8" strokeWidth="0.35">
                                          {rainPositions.map(([x, y], i) => (
                                            <path key={i} d={DROP_PATH} transform={`translate(${x},${y}) scale(0.9)`} aria-hidden />
                                          ))}
                                        </g>
                                      </svg>
                                    )
                                  })()
                                : null
                            return svgToShow ? (
                              <div className="single-course-course__gpx-map">
                                <div
                                  className="single-course-course__gpx-svg"
                                  dangerouslySetInnerHTML={{ __html: svgToShow.replace('<svg', '<svg id=\"gpx-inline-svg\"') }}
                                />
                                {rainOverlay3D}
                                {viewBox3D && <WindVectorChart viewBox={viewBox3D} windDir={windDir} windSpeedKmh={windSpeedKmh} />}
                              </div>
                            ) : (
                              <img src={gpxIcon} alt="GPX" />
                            )
                          })()
                        ) : segmentZoomedSvg ? (
                          <div className="single-course-course__gpx-map">
                            <div
                              className="single-course-course__gpx-svg"
                              dangerouslySetInnerHTML={{ __html: segmentZoomedSvg.replace('<svg', '<svg id=\"gpx-inline-svg\"') }}
                            />
                            {parseViewBox(segmentZoomedSvg) && (
                              <WindVectorChart viewBox={parseViewBox(segmentZoomedSvg)!} windDir={windDir} windSpeedKmh={windSpeedKmh} />
                            )}
                            {(() => {
                              const viewBox = parseViewBox(segmentZoomedSvg)
                              if (!viewBox || !rainAlongRoute?.length || !gpxBounds) return null
                              const allRain = rainAlongRoute
                                .filter((p) => p.rain)
                                .map((p) => latLonToSvg(p.lat, p.lon, gpxBounds))
                              if (allRain.length === 0) return null
                              const parts = viewBox.trim().split(/\s+/).map(Number)
                              const minX = parts[0]; const minY = parts[1]; const w = parts[2]; const h = parts[3]
                              const inSegment = parts.length === 4 && !parts.some(Number.isNaN)
                                ? allRain.filter(([x, y]) => x >= minX && x <= minX + w && y >= minY && y <= minY + h)
                                : allRain
                              const rainPositions = inSegment.length > 0 ? inSegment : [[minX + w / 2, minY + h / 2]]
                              return (
                                <svg
                                  className="single-course-course__gpx-rain-overlay"
                                  viewBox={viewBox}
                                  preserveAspectRatio="xMidYMid meet"
                                  width="100%"
                                  height="100%"
                                  aria-hidden
                                  style={{ pointerEvents: 'none' }}
                                >
                                  <title>Pluie — secteurs où il a plu (24h)</title>
                                  <g fill="#3b82f6" stroke="#1d4ed8" strokeWidth="0.35">
                                    {rainPositions.map(([x, y], i) => (
                                      <path key={i} d={DROP_PATH} transform={`translate(${x},${y}) scale(0.9)`} />
                                    ))}
                                  </g>
                                </svg>
                              )
                            })()}
                          </div>
                        ) : (
                          <img src={gpxIcon} alt="GPX" />
                        )}
                      </div>
                      <p className="single-course-course__segment-selected" aria-live="polite">
                        Segment {selectedSegment.segmentNumber} — {selectedSegment.startKm.toFixed(1)} – {selectedSegment.endKm.toFixed(1)} km
                      </p>
                    </div>
                    <div className="single-course-right">
                      <div className="single-course-chart-block single-course-segment-page__stats-card">
                        <p className="single-course-panel__title">Secteur {selectedSegment.segmentNumber}</p>
                        <div className="single-course-segment-page__chart">
                          <SingleCourseElevationChart data={segmentProfile} metrics={undefined} />
                        </div>
                        {segStats != null ? (
                          <>
                            <dl className="single-course-segment-page__stats">
                              <div className="single-course-segment-page__stat">
                                <dt>Longueur</dt>
                                <dd>{segStats.distanceKm.toFixed(1)} km</dd>
                              </div>
                              <div className="single-course-segment-page__stat">
                                <dt>D+</dt>
                                <dd>{segStats.elevationGain} m</dd>
                              </div>
                              <div className="single-course-segment-page__stat">
                                <dt>D-</dt>
                                <dd>{segStats.elevationLoss} m</dd>
                              </div>
                              <div className="single-course-segment-page__stat">
                                <dt>Pente moy.</dt>
                                <dd>{segStats.averageGradePercent} %</dd>
                              </div>
                              <div className="single-course-segment-page__stat">
                                <dt>Profil</dt>
                                <dd>
                                  {segStats.elevationGain > segStats.elevationLoss * 1.5
                                    ? 'Montée'
                                    : segStats.elevationLoss > segStats.elevationGain * 1.5
                                      ? 'Descente'
                                      : 'Mixte'}
                                </dd>
                              </div>
                            </dl>
                            <div className="single-course-segment-page__advice">
                              <p className="single-course-segment-page__advice-label">Conseil de passage</p>
                              <p className="single-course-segment-page__advice-text">
                                {segStats.elevationGain > segStats.elevationLoss * 1.5
                                  ? `Sur ce secteur en montée (${segStats.averageGradePercent} % de pente moyenne), concentrez-vous sur votre gestion d'allure. Adoptez une foulée régulière et n'hésitez pas à marcher dans les portions les plus raides pour préserver vos jambes. Pensez à vous hydrater et à vous alimenter avant les passages techniques. En maîtrisant ce secteur, vous aborderez la suite du parcours en meilleure condition.`
                                  : segStats.elevationLoss > segStats.elevationGain * 1.5
                                    ? `Sur ce secteur en descente, privilégiez la régularité et la prudence. Contrôlez votre vitesse pour éviter les chocs et les blessures, et gardez les jambes souples. Anticipez les changements de terrain et adaptez votre foulée. Une bonne descente préserve vos quadriceps pour la suite.`
                                    : `Sur ce secteur mixte, alternez course et marche selon la pente pour garder un effort constant. Gérez votre allure sur la longueur du segment et pensez à vous alimenter et vous hydrater. En restant régulier, vous préservez vos réserves pour les secteurs clés à venir.`}
                              </p>
                            </div>
                          </>
                        ) : null}
                      </div>
                    </div>
                  </>
                )
              })() : (
                <div className="single-course-segment-page single-course-segment-page--empty">
                  <p className="single-course-segment-page__empty">
                    Sélectionnez un segment sur la carte ou dans la liste (étape Description) pour afficher son détail.
                  </p>
                </div>
              )
            )}

            {currentStep === 'ma-preparation' && (
              <>
                <div className="single-course-course single-course-preparation__left">
                  <div className="single-course-preparation__top">
                    <div className="single-course-preparation__top-title-row">
                      <p className="single-course-preparation__intro">Préparation en cours : M-6</p>
                      <input
                        ref={fitFileInputRef}
                        type="file"
                        accept=".fit,application/fit"
                        className="single-course-preparation__fit-input"
                        aria-hidden
                        onChange={async (e) => {
                          const file = e.target.files?.[0]
                          e.target.value = ''
                          if (!file) return
                          setFitFileName(file.name)
                          setFitParseError(null)
                          setFitParsedData(null)
                          setFitParseLoading(true)
                          try {
                            const buffer = await file.arrayBuffer()
                            const parser = new FitParser({
                              mode: 'cascade',
                              lengthUnit: 'km',
                              speedUnit: 'km/h',
                            })
                            const data = await parser.parseAsync(buffer)
                            const summary = getFitSummary(data as Parameters<typeof getFitSummary>[0])
                            setFitParsedData(summary)
                            if (!summary) {
                              setFitParseError('Aucune session ou tour trouvé dans ce fichier .fit')
                            } else {
                              setFitParseError(null)
                              try {
                                localStorage.setItem(
                                  fitStorageKey,
                                  JSON.stringify({
                                    summary,
                                    fileName: file.name,
                                    importedAt: new Date().toISOString(),
                                  })
                                )
                              } catch {
                                // ignore
                              }
                              getCurrentUser().then((user) => {
                                if (user?.id) {
                                  saveUserFitActivity(user.id, file.name, summary).then(() => {
                                    getUserFitActivities(user.id).then((rows) => {
                                      setUserFitActivities(rows)
                                      try {
                                        const top5 = rows.slice(0, 5).map((r) => r.summary)
                                        if (top5.length > 0) {
                                          localStorage.setItem('vizion_user_fit_top5', JSON.stringify(top5))
                                        }
                                      } catch {
                                        // ignore
                                      }
                                    })
                                  })
                                }
                              })
                            }
                          } catch (err) {
                            setFitParseError(err instanceof Error ? err.message : 'Erreur lecture .fit')
                            setFitParsedData(null)
                          } finally {
                            setFitParseLoading(false)
                          }
                        }}
                      />
                      <div className="single-course-preparation__fit-block">
                        <button
                          type="button"
                          className="single-course-preparation__export-btn single-course-preparation__fit-btn"
                          onClick={() => fitFileInputRef.current?.click()}
                          disabled={fitParseLoading}
                          aria-label="Importer un fichier .fit"
                        >
                          {fitParseLoading ? 'Chargement…' : (fitFileName ?? 'Importer .fit')}
                        </button>
                        {fitParseError && (
                          <p className="single-course-preparation__fit-error" role="alert">
                            {fitParseError}
                          </p>
                        )}
                        {fitParsedData && !fitParseLoading && (
                          <div className="single-course-preparation__fit-summary">
                            <span className="single-course-preparation__fit-summary-label">Activité importée :</span>
                            {' '}
                            {[
                              fitParsedData.distanceKm != null && `${fitParsedData.distanceKm.toFixed(1)} km`,
                              fitParsedData.durationSec != null && formatDuration(fitParsedData.durationSec),
                              fitParsedData.ascentM != null && `${Math.round(fitParsedData.ascentM)} m D+`,
                            ].filter(Boolean).join(' · ')}
                            {fitParsedData.sport && (
                              <span className="single-course-preparation__fit-sport"> · {fitParsedData.sport}</span>
                            )}
                          </div>
                        )}
                        {currentUserId && (
                          <p className="single-course-preparation__fit-hint">
                            {effectiveFitTop5.length > 0
                              ? 'Vos 5 sorties les plus longues (compte Trackali) sont utilisées pour l\'analyse.'
                              : 'Ajoutez des .fit depuis Mon compte pour améliorer l\'analyse.'}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="single-course-preparation__export">
                      <button
                        type="button"
                        className="single-course-preparation__export-btn"
                        onClick={() => window.print()}
                        aria-label="Imprimer ou enregistrer en PDF"
                      >
                        Imprimer / PDF
                      </button>
                      <button
                        type="button"
                        className="single-course-preparation__export-btn"
                        onClick={() => {
                          const url = typeof window !== 'undefined' ? window.location.href : ''
                          navigator.clipboard?.writeText(url).then(() => {}, () => {})
                        }}
                        aria-label="Copier le lien de la page"
                      >
                        Copier le lien
                      </button>
                    </div>
                  </div>
                  <div className="single-course-preparation__hero">
                    <div className="single-course-preparation__hero-state">
                      <span className="single-course-preparation__hero-emoji" aria-hidden>
                        {analysis.readiness === 'ready' ? '🟢' : analysis.readiness === 'needs_work' ? '🟠' : '🔴'}
                      </span>
                      <div>
                        <p className="single-course-preparation__hero-label">{analysis.readinessLabel}</p>
                        <p className="single-course-preparation__hero-sublabel">
                          {aiContent?.stateSublabel || (analysis.readiness === 'ready' ? 'Niveau prêt pour la course' : analysis.readiness === 'needs_work' ? 'Quelques ajustements recommandés' : 'Préparation à renforcer')}
                        </p>
                      </div>
                    </div>
                    <div className="single-course-preparation__hero-metrics">
                      <div className="single-course-preparation__hero-load">
                        <span className="single-course-preparation__hero-load-value">{metricsForAnalysis ? metricsForAnalysis.loadScore.toLocaleString('fr-FR') : '—'}</span>
                        <span className="single-course-preparation__hero-load-unit">charge 6 sem.</span>
                      </div>
                      <div className="single-course-preparation__hero-delta">
                        {metricsForAnalysis ? `${metricsForAnalysis.loadDelta > 0 ? '+' : ''}${metricsForAnalysis.loadDelta}%` : '—'} vs sem. précédente
                      </div>
                    </div>
                    {analysis.timeEstimate && (
                      <div className="single-course-preparation__hero-time">
                        <span className="single-course-preparation__hero-time-label">Temps estimé</span>
                        <span className="single-course-preparation__hero-time-value">{analysis.timeEstimate.rangeFormatted}</span>
                      </div>
                    )}
                  </div>
                  {analysis.next4WeeksGoals && (
                    <div className="single-course-preparation__next-deadline">
                      <span className="single-course-preparation__next-deadline-label">Prochaine échéance (4 semaines)</span>
                      <span className="single-course-preparation__next-deadline-text">
                        {aiContent?.next4WeeksSummary || `Vise ${analysis.next4WeeksGoals.volumeKm.min}–${analysis.next4WeeksGoals.volumeKm.max} km/sem, ${analysis.next4WeeksGoals.dPlus.min}–${analysis.next4WeeksGoals.dPlus.max} m D+/sem, ${analysis.next4WeeksGoals.frequency} sorties/sem, 1 sortie > ${analysis.next4WeeksGoals.longRunHours} h.`}
                      </span>
                    </div>
                  )}
                  {metricsForAnalysis && (
                    <div className="single-course-preparation__trend" aria-label="Évolution de la charge sur 6 semaines">
                      <p className="single-course-preparation__trend-title">Évolution de la charge (6 semaines)</p>
                      <div className="single-course-preparation__trend-chart">
                        {(() => {
                          const weeks = ['M-6', 'M-5', 'M-4', 'M-3', 'M-2', 'M-1']
                          const coef = 1 - (metricsForAnalysis.loadDelta ?? 0) / 100
                          const values = weeks.map((_, i) => Math.round(metricsForAnalysis.loadScore * Math.pow(coef, 5 - i)))
                          const minV = Math.min(...values)
                          const maxV = Math.max(...values)
                          const range = maxV - minV || 1
                          const w = 280
                          const h = 48
                          const pad = 4
                          const points = values.map((v, i) => {
                            const x = pad + (i / (values.length - 1)) * (w - 2 * pad)
                            const y = h - pad - ((v - minV) / range) * (h - 2 * pad)
                            return `${x},${y}`
                          }).join(' ')
                          return (
                            <svg width="100%" height={h} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" aria-hidden>
                              <polyline
                                fill="none"
                                stroke="var(--color-accent, #bfc900)"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                points={points}
                              />
                            </svg>
                          )
                        })()}
                      </div>
                      <div className="single-course-preparation__trend-labels">
                        <span>M-6</span>
                        <span>M-1</span>
                      </div>
                    </div>
                  )}
                  <div className="single-course-panel single-course-panel--full">
                    <div className="single-course-panel__cards">
                      <div className="single-course-panel__card">
                        <p className="single-course-panel__title">ÉTAT DE PRÉPARATION</p>
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '12px',
                          marginTop: '12px',
                          padding: '12px',
                          borderRadius: '8px',
                          background:
                            analysis.readiness === 'ready'
                              ? 'rgba(34, 197, 94, 0.1)'
                              : analysis.readiness === 'needs_work'
                                ? 'rgba(251, 191, 36, 0.1)'
                                : 'rgba(239, 68, 68, 0.1)',
                          border: `1px solid ${
                            analysis.readiness === 'ready'
                              ? 'rgba(34, 197, 94, 0.3)'
                              : analysis.readiness === 'needs_work'
                                ? 'rgba(251, 191, 36, 0.3)'
                                : 'rgba(239, 68, 68, 0.3)'
                          }`,
                        }}
                      >
                        <span
                          style={{
                            fontSize: '32px',
                            fontWeight: 'bold',
                            color:
                              analysis.readiness === 'ready'
                                ? '#22c55e'
                                : analysis.readiness === 'needs_work'
                                  ? '#fbbf24'
                                  : '#ef4444',
                          }}
                        >
                          {analysis.readiness === 'ready' ? '🟢' : analysis.readiness === 'needs_work' ? '🟠' : '🔴'}
                        </span>
                        <div>
                          <p style={{ margin: 0, fontSize: '18px', fontWeight: 600 }}>{analysis.readinessLabel}</p>
                          <p style={{ margin: '4px 0 0', fontSize: '12px', opacity: 0.8 }}>
                            {aiContent?.stateSublabel || (analysis.readiness === 'ready' ? 'Vous êtes prêt pour cette course' : analysis.readiness === 'needs_work' ? 'Quelques ajustements nécessaires' : 'Attention : préparation insuffisante')}
                          </p>
                        </div>
                      </div>
                      {(aiContent?.summary ?? analysis.summary) && (
                        <p style={{ marginTop: '16px', fontSize: '14px', lineHeight: '1.5', color: 'var(--color-text-primary, #e5e7eb)' }}>
                          {aiContent?.summary ?? analysis.summary}
                        </p>
                      )}
                      {(aiContent?.coachVerdict || analysis.coachVerdict) && (
                        <div style={{ marginTop: '16px', padding: '12px', borderRadius: '8px', background: 'rgba(191, 201, 0, 0.1)', border: '1px solid rgba(191, 201, 0, 0.3)' }}>
                          <p style={{ margin: 0, fontSize: '13px', lineHeight: '1.6', color: 'var(--color-text-primary, #e5e7eb)', fontStyle: 'italic' }}>
                            💬 <strong>Verdict du Coach :</strong> {aiContent?.coachVerdict ?? analysis.coachVerdict}
                          </p>
                        </div>
                      )}
                    </div>

                    <div className="single-course-panel__card">
                      <p className="single-course-panel__title">🎯 OBJECTIF DES 4 PROCHAINES SEMAINES</p>
                      {analysis.next4WeeksGoals && (
                        <div style={{ marginTop: '12px' }}>
                          <ul className="single-course-panel__list" style={{ marginBottom: '12px' }}>
                            <li>
                              <span>Volume cible</span>
                              <span>{analysis.next4WeeksGoals.volumeKm.min}–{analysis.next4WeeksGoals.volumeKm.max} km / semaine</span>
                            </li>
                            <li>
                              <span>D+ cible</span>
                              <span>{analysis.next4WeeksGoals.dPlus.min}–{analysis.next4WeeksGoals.dPlus.max} m / semaine</span>
                            </li>
                            <li>
                              <span>Fréquence</span>
                              <span>{analysis.next4WeeksGoals.frequency} sorties / semaine</span>
                            </li>
                            <li>
                              <span>Sortie longue</span>
                              <span>1 sortie &gt; {analysis.next4WeeksGoals.longRunHours}h</span>
                            </li>
                          </ul>
                          <p style={{ marginTop: '12px', fontSize: '12px', color: 'var(--color-text-secondary, #9ca3af)', fontStyle: 'italic' }}>
                            {aiContent?.next4WeeksSummary || `Si ces objectifs sont atteints, ton état de préparation passera de ${analysis.readiness === 'risk' ? '🔴 Risque' : analysis.readiness === 'needs_work' ? '🟠 À renforcer' : '🟢 Prêt'} à ${analysis.projection.ifFollowsGoals.m3 === 'ready' ? '🟢 Prêt' : analysis.projection.ifFollowsGoals.m3 === 'needs_work' ? '🟠 À renforcer' : '🔴 Risque'}.`}
                          </p>
                        </div>
                      )}
                    </div>

                    <div className="single-course-panel__card">
                      <p className="single-course-panel__title">CHARGE &amp; RÉGULARITÉ (6 semaines)</p>
                      <ul className="single-course-panel__list">
                        <li><span>km / semaine</span><span>{metricsForAnalysis ? `${metricsForAnalysis.kmPerWeek} km` : '...'}</span></li>
                        <li><span>d+ / semaine</span><span>{metricsForAnalysis ? `${metricsForAnalysis.dPlusPerWeek} m` : '...'}</span></li>
                        <li><span>longue sortie max</span><span>{metricsForAnalysis ? `${metricsForAnalysis.longRunDistanceKm} km – ${metricsForAnalysis.longRunDPlus} m D+` : '...'}</span></li>
                        <li>
                          <span>régularité</span>
                          <span className={`single-course-panel__pill${analysis.regularity === 'bonne' ? ' single-course-panel__pill--ok' : ''}${analysis.regularity === 'faible' ? ' single-course-panel__pill--warning' : ''}`} title={analysis.regularityDetails}>{analysis.regularity}</span>
                        </li>
                        <li><span>variation charge</span><span>{metricsForAnalysis ? `${metricsForAnalysis.variation > 0 ? '+' : ''}${metricsForAnalysis.variation.toFixed(1)}% / semaine` : '...'}</span></li>
                      </ul>
                      {analysis.timeEstimate && (
                        <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
                          <p style={{ fontSize: '12px', color: 'var(--color-text-secondary, #9ca3af)', marginBottom: '8px' }}>⏱️ Temps estimé de course</p>
                          <p style={{ fontSize: '18px', fontWeight: 600, color: 'var(--color-accent, #bfc900)' }}>{analysis.timeEstimate.rangeFormatted}</p>
                          <p style={{ fontSize: '11px', color: 'var(--color-text-secondary, #9ca3af)', marginTop: '4px', fontStyle: 'italic' }}>Basé sur ton allure actuelle, le dénivelé et la distance (fourchette indicative)</p>
                        </div>
                      )}
                      {analysis.timeEstimate && (
                        <SimulationEngine
                          distanceKm={courseData.distanceKm}
                          elevationGain={courseData.elevationGain}
                          metrics={metrics}
                          baseTimeEstimate={analysis.timeEstimate}
                          temperature={courseData.temperature}
                        />
                      )}
                    </div>
                    </div>
                  </div>
                </div>

                <div className="single-course-right single-course-preparation__right">
                    <div className="single-course-panel__card">
                    <p className="single-course-panel__title">AJUSTEMENTS RECOMMANDÉS</p>
                      {(aiContent?.immediateActions?.length ? aiContent.immediateActions : analysis.immediateActions)?.map && (
                        <div style={{ marginTop: '12px', marginBottom: '16px' }}>
                          <p style={{ fontSize: '13px', color: '#ef4444', marginBottom: '8px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}><FiAlertCircle style={{ width: '24px', height: '24px', flexShrink: 0 }} /> Priorité immédiate</p>
                          <ul className="single-course-panel__list single-course-preparation__action-list">
                            {(aiContent?.immediateActions?.length ? aiContent.immediateActions : analysis.immediateActions || []).map((action, idx) => (
                              <li key={idx} className="single-course-preparation__action-item">
                                <label style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', cursor: 'pointer', fontSize: '12px' }}>
                                  <input
                                    type="checkbox"
                                    checked={!!preparationCheckedActions[action]}
                                    onChange={() => togglePreparationAction(action)}
                                    className="single-course-preparation__action-checkbox"
                                  />
                                  <span style={{ textDecoration: preparationCheckedActions[action] ? 'line-through' : undefined, opacity: preparationCheckedActions[action] ? 0.7 : 1 }}>{action}</span>
                                </label>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {((aiContent?.secondaryActions?.length ? aiContent.secondaryActions : analysis.secondaryActions) || []).length > 0 && (
                        <div style={{ marginBottom: '16px' }}>
                          <p style={{ fontSize: '13px', color: '#fbbf24', marginBottom: '8px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}><FiAlertCircle style={{ width: '24px', height: '24px', flexShrink: 0 }} /> Important mais secondaire</p>
                          <ul className="single-course-panel__list single-course-preparation__action-list">
                            {(aiContent?.secondaryActions?.length ? aiContent.secondaryActions : analysis.secondaryActions || []).map((action, idx) => (
                              <li key={idx} className="single-course-preparation__action-item">
                                <label style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', cursor: 'pointer', fontSize: '12px' }}>
                                  <input
                                    type="checkbox"
                                    checked={!!preparationCheckedActions[action]}
                                    onChange={() => togglePreparationAction(action)}
                                    className="single-course-preparation__action-checkbox"
                                  />
                                  <span style={{ textDecoration: preparationCheckedActions[action] ? 'line-through' : undefined, opacity: preparationCheckedActions[action] ? 0.7 : 1 }}>{action}</span>
                                </label>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {analysis.testActions && analysis.testActions.length > 0 && (
                        <div style={{ marginBottom: '16px' }}>
                          <p style={{ fontSize: '13px', color: '#9ca3af', marginBottom: '8px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}><FiZap style={{ width: '24px', height: '24px', flexShrink: 0 }} /> À tester</p>
                          <ul className="single-course-panel__list single-course-preparation__action-list">
                            {analysis.testActions.map((action, idx) => (
                              <li key={idx} className="single-course-preparation__action-item">
                                <label style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', cursor: 'pointer', fontSize: '12px' }}>
                                  <input
                                    type="checkbox"
                                    checked={!!preparationCheckedActions[action]}
                                    onChange={() => togglePreparationAction(action)}
                                    className="single-course-preparation__action-checkbox"
                                  />
                                  <span style={{ textDecoration: preparationCheckedActions[action] ? 'line-through' : undefined, opacity: preparationCheckedActions[action] ? 0.7 : 1 }}>{action}</span>
                                </label>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                  </div>
                  {aiContentError && (
                    <p className="single-course-preparation__fit-error" role="alert" style={{ marginBottom: '12px' }}>
                      {aiContentError}
                    </p>
                  )}
                  {aiContentLoading && !aiContent && (
                    <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', marginBottom: '12px' }}>
                      Génération des textes par l&apos;IA…
                    </p>
                  )}
                  <div className="single-course-panel__card" style={{ marginTop: '8px' }}>
                    <p className="single-course-panel__title">🧠 PROJECTION</p>
                      <div style={{ marginTop: '12px' }}>
                        <div style={{ marginBottom: '16px' }}>
                          <p style={{ fontSize: '12px', color: '#9ca3af', marginBottom: '8px', fontWeight: 500 }}>Si tu continues ainsi</p>
                          {aiContent?.projectionIfContinues ? (
                            <p style={{ fontSize: '13px', lineHeight: 1.5 }}>{aiContent.projectionIfContinues}</p>
                          ) : (
                            <ul className="single-course-panel__list" style={{ fontSize: '12px' }}>
                              <li><span>État prévu à M-3</span><span>{analysis.projection.ifContinues.m3 === 'ready' ? '🟢 Prêt' : analysis.projection.ifContinues.m3 === 'needs_work' ? '🟠 À renforcer' : '🔴 Risque'}</span></li>
                              <li><span>État prévu à M-1</span><span>{analysis.projection.ifContinues.m1 === 'ready' ? '🟢 Prêt' : analysis.projection.ifContinues.m1 === 'needs_work' ? '🟠 À renforcer' : '🔴 Risque'}</span></li>
                            </ul>
                          )}
                        </div>
                        <div>
                          <p style={{ fontSize: '12px', color: '#22c55e', marginBottom: '8px', fontWeight: 500 }}>Si tu suis les objectifs recommandés</p>
                          {aiContent?.projectionIfFollows ? (
                            <p style={{ fontSize: '13px', lineHeight: 1.5 }}>{aiContent.projectionIfFollows}</p>
                          ) : (
                            <ul className="single-course-panel__list" style={{ fontSize: '12px' }}>
                              <li><span>État prévu à M-3</span><span>{analysis.projection.ifFollowsGoals.m3 === 'ready' ? '🟢 Prêt' : analysis.projection.ifFollowsGoals.m3 === 'needs_work' ? '🟠 À renforcer' : '🔴 Risque'}</span></li>
                              <li><span>État prévu à M-1</span><span>{analysis.projection.ifFollowsGoals.m1 === 'ready' ? '🟢 Prêt (partiellement)' : analysis.projection.ifFollowsGoals.m1 === 'needs_work' ? '🟠 À renforcer' : '🔴 Risque'}</span></li>
                            </ul>
                          )}
                        </div>
                      </div>
                    <p style={{ marginTop: '12px', fontSize: '11px', color: 'var(--color-text-secondary, #9ca3af)' }}>
                      Textes générés par l&apos;IA à partir de tes .fit · mis à jour chaque semaine.
                      {' '}
                      <button
                        type="button"
                        className="single-course-preparation__export-btn"
                        style={{ padding: '2px 8px', fontSize: '11px' }}
                        onClick={() => {
                          if (!courseData) return
                          const key = `${AI_CONTENT_CACHE_PREFIX}${courseId}_${courseData.distanceKm}_${courseData.elevationGain}_${effectiveFitTop5.length}_${fitSignature}`
                          try { localStorage.removeItem(key) } catch {}
                          setAiContent(null)
                          setAiContentGeneratedAt(null)
                          setAiContentLoading(true)
                          setAiContentError(null)
                          const fitPayload = effectiveFitTop5.map((s, i) => ({
                            distanceKm: s.distanceKm ?? null,
                            durationSec: s.durationSec ?? null,
                            ascentM: s.ascentM ?? null,
                            fileName: userFitActivities[i]?.file_name ?? null,
                          }))
                          const base = typeof window !== 'undefined' ? window.location.origin : ''
                          fetch(`${base}/api/preparation/content`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                              course: { distanceKm: courseData.distanceKm, elevationGain: courseData.elevationGain, name: courseData.name },
                              fitActivities: fitPayload,
                              metricsSummary: analysis?.summary ?? null,
                              readiness: analysis?.readiness ?? null,
                              next4WeeksGoals: analysis?.next4WeeksGoals ?? null,
                            }),
                          })
                            .then((r) => r.json())
                            .then((data) => {
                              if (data.error) {
                                setAiContentError(data.message || data.error)
                                setAiContent(null)
                              } else {
                                setAiContent({
                                  summary: data.summary ?? '',
                                  coachVerdict: data.coachVerdict ?? '',
                                  stateSublabel: data.stateSublabel ?? '',
                                  next4WeeksSummary: data.next4WeeksSummary ?? '',
                                  immediateActions: Array.isArray(data.immediateActions) ? data.immediateActions : [],
                                  secondaryActions: Array.isArray(data.secondaryActions) ? data.secondaryActions : [],
                                  projectionIfContinues: data.projectionIfContinues ?? '',
                                  projectionIfFollows: data.projectionIfFollows ?? '',
                                  segmentIntro: data.segmentIntro,
                                })
                                setAiContentGeneratedAt(Date.now())
                                try { localStorage.setItem(key, JSON.stringify({ generatedAt: Date.now(), content: { summary: data.summary, coachVerdict: data.coachVerdict, stateSublabel: data.stateSublabel, next4WeeksSummary: data.next4WeeksSummary, immediateActions: data.immediateActions, secondaryActions: data.secondaryActions, projectionIfContinues: data.projectionIfContinues, projectionIfFollows: data.projectionIfFollows, segmentIntro: data.segmentIntro } })) } catch {}
                              }
                            })
                            .catch((err) => { setAiContentError(err?.message ?? 'Erreur réseau'); setAiContent(null) })
                            .finally(() => setAiContentLoading(false))
                        }}
                        aria-label="Rafraîchir les textes IA"
                      >
                        Rafraîchir
                      </button>
                    </p>
                  </div>
                  {segmentBoundsList.length > 0 && (
                    <div className="single-course-panel__card">
                      <p className="single-course-panel__title">📌 Préparation par segment</p>
                      <p className="single-course-preparation__segment-intro">
                        {aiContent?.segmentIntro || `Ton D+ max entraîné (${metricsForAnalysis ? `${metricsForAnalysis.longRunDPlus} m` : '—'}) par rapport au D+ de chaque tronçon de la course.`}
                      </p>
                      <ul className="single-course-panel__list single-course-preparation__segment-list">
                        {segmentBoundsList.map((seg) => {
                          const stats = getSegmentStats(seg.startKm, seg.endKm)
                          const covered = metricsForAnalysis && stats && metricsForAnalysis.longRunDPlus >= stats.elevationGain
                          return (
                            <li key={seg.segmentNumber} className="single-course-preparation__segment-item">
                              <span>Segment {seg.segmentNumber}</span>
                              <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                {stats ? `${stats.elevationGain} m D+` : '—'}
                                {stats && metrics && (
                                  <span
                                    className={`single-course-preparation__segment-badge ${covered ? 'single-course-preparation__segment-badge--ok' : 'single-course-preparation__segment-badge--warning'}`}
                                    title={covered ? 'Ton D+ max couvre ce segment' : 'Segment plus exigeant que ta sortie max'}
                                  >
                                    {covered ? '✓' : '!'}
                                  </span>
                                )}
                              </span>
                            </li>
                          )
                        })}
                      </ul>
                    </div>
                  )}
                </div>
              </>
            )}
          </section>
        </main>
      </div>
    </div>
  )
}
