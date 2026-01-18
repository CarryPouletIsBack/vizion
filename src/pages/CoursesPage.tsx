import './CoursesPage.css'

import gpxIcon from '../assets/d824ad10b22406bc6f779da5180da5cdaeca1e2c.svg'
import grandRaidLogo from '../assets/da2a1ce5e69564e56a29b5912fd151a8f515e136.png'
import HeaderTopBar from '../components/HeaderTopBar'
import SideNav from '../components/SideNav'
import Skeleton from '../components/Skeleton'
import useStravaMetrics from '../hooks/useStravaMetrics'

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
  onCreateCourse?: () => void
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
  const courseCards =
    selectedEvent?.courses
      .filter((course) => course.name.trim().toLowerCase() !== 'sans titre')
      .map((course, index) => {
        const courseDistanceKm = course.distanceKm ?? 175
        const courseElevationGain = course.elevationGain ?? 10150
        const readinessPercentage = calculateReadinessPercentage(metrics, courseDistanceKm, courseElevationGain)
        
        return {
          id: course.id,
          title: selectedEvent.name,
          year: '2026',
          subtitle: course.name,
          stats:
            course.distanceKm && course.elevationGain
              ? `${course.distanceKm.toFixed(0)} km – ${Math.round(course.elevationGain)} D+`
              : '165 km – 9 800 D+',
          readiness: `${readinessPercentage}%`,
          countdown: '6 mois',
          imageUrl: course.imageUrl ?? selectedEvent.imageUrl ?? grandRaidLogo,
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
                onClick={onCreateCourse}
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
                      <p>
                        État de préparation : <Skeleton width="40px" height="16px" className="skeleton-inline" />
                      </p>
                    ) : (
                      <p>
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
    </div>
  )
}
