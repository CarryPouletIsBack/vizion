import './SingleCoursePage.css'

import gpxIcon from '../assets/d824ad10b22406bc6f779da5180da5cdaeca1e2c.svg'
import HeaderTopBar from '../components/HeaderTopBar'
import SideNav from '../components/SideNav'
import SingleCourseElevationChart from '../components/SingleCourseElevationChart'
import useGpxHoverMarker from '../hooks/useGpxHoverMarker'
import useStravaMetrics from '../hooks/useStravaMetrics'
import { analyzeCourseReadiness } from '../lib/courseAnalysis'

type SingleCoursePageProps = {
  onNavigate?: (view: 'saison' | 'events' | 'courses' | 'course') => void
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
  const coursePrep = 'Préparation en cours : M-6'
  const rawProfile = (selectedCourse as { profile?: Array<[number, number]> } | undefined)?.profile
  // S'assurer que profileData est un tableau valide
  const profileData = Array.isArray(rawProfile) && rawProfile.length > 0 ? rawProfile : undefined
  const gpxSvg = selectedCourse?.gpxSvg
  const maxDistance = profileData?.length ? profileData[profileData.length - 1][0] : undefined
  useGpxHoverMarker('gpx-inline-svg', maxDistance)
  const { metrics } = useStravaMetrics()

  // Analyser la préparation pour cette course
  const courseData = selectedCourse?.distanceKm && selectedCourse?.elevationGain
    ? {
        distanceKm: selectedCourse.distanceKm,
        elevationGain: selectedCourse.elevationGain,
        name: selectedCourse.name,
      }
    : {
        distanceKm: 175,
        elevationGain: 10150,
        name: 'Grand Raid',
      }

  const analysis = analyzeCourseReadiness(metrics, courseData)
  return (
    <div className="single-course-page">
      <HeaderTopBar onNavigate={onNavigate} />

      <div className="single-course-body">
        <aside className="single-course-side">
          <SideNav activeItem="saison" onNavigate={onNavigate} />
        </aside>

        <main className="single-course-main">
          <section className="single-course-heading">
            <div>
              <p className="single-course-title">{courseTitle.toUpperCase()}</p>
              <p className="single-course-subtitle">{courseEventName}</p>
            </div>
            <div className="single-course-card">
              <div>
                <p className="single-course-card__title">Ajouter un événement ou une course</p>
                <p className="single-course-card__subtitle">Commencer dès à présent à vous préparez</p>
              </div>
              <span className="single-course-card__chevron" aria-hidden="true">
                ›
              </span>
            </div>
          </section>

          <section className="single-course-content">
            <div className="single-course-course">
              <div className="single-course-course__meta">
                <p className="single-course-course__meta-title">{courseHeading}</p>
                <p className="single-course-course__meta-stats">{courseStats}</p>
                <p className="single-course-course__meta-prep">{coursePrep}</p>
              </div>
              <div className="single-course-course__gpx">
                {gpxSvg ? (
                  <div
                    className="single-course-course__gpx-svg"
                    dangerouslySetInnerHTML={{ __html: gpxSvg.replace('<svg', '<svg id=\"gpx-inline-svg\"') }}
                  />
                ) : (
                  <img src={gpxIcon} alt="GPX" />
                )}
              </div>
              <div className="single-course-course__card">
                <SingleCourseElevationChart data={profileData} />
              </div>
            </div>

            <div className="single-course-panel">
              <div className="single-course-panel__header">
                <p>CHARGE & RÉGULARITÉ (6 semaines)</p>
                <div className="single-course-panel__value">
                  <span>{metrics ? metrics.loadScore.toLocaleString('fr-FR') : '...'}</span>
                  <span className="single-course-panel__delta">
                    {metrics ? `${metrics.loadDelta > 0 ? '+' : ''}${metrics.loadDelta}%` : '...'}
                  </span>
                </div>
              </div>
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
                        {analysis.readiness === 'ready'
                          ? 'Vous êtes prêt pour cette course'
                          : analysis.readiness === 'needs_work'
                            ? 'Quelques ajustements nécessaires'
                            : 'Attention : préparation insuffisante'}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="single-course-panel__card">
                  <p className="single-course-panel__title">CHARGE &amp; RÉGULARITÉ (6 semaines)</p>
                  <ul className="single-course-panel__list">
                    <li>
                      <span>km / semaine</span>
                      <span>{metrics ? `${metrics.kmPerWeek} km` : '...'}</span>
                    </li>
                    <li>
                      <span>d+ / semaine</span>
                      <span>{metrics ? `${metrics.dPlusPerWeek} m` : '...'}</span>
                    </li>
                    <li>
                      <span>longue sortie max</span>
                      <span>
                        {metrics
                          ? `${metrics.longRunDistanceKm} km – ${metrics.longRunDPlus} d+`
                          : '...'}
                      </span>
                    </li>
                    <li>
                      <span>régularité</span>
                      <span
                        className={`single-course-panel__pill${
                          analysis.regularity === 'bonne' ? ' single-course-panel__pill--ok' : ''
                        }${analysis.regularity === 'faible' ? ' single-course-panel__pill--warning' : ''}`}
                        title={analysis.regularityDetails}
                      >
                        {analysis.regularity}
                      </span>
                    </li>
                    <li>
                      <span>variation charge</span>
                      <span>
                        {metrics
                          ? `${metrics.variation > 0 ? '+' : ''}${metrics.variation.toFixed(1)}% / semaine`
                          : '...'}
                      </span>
                    </li>
                  </ul>
                </div>

                <div className="single-course-panel__card">
                  <p className="single-course-panel__title">AJUSTEMENTS RECOMMANDÉS</p>
                  {analysis.issues.length > 0 && (
                    <div style={{ marginBottom: '12px' }}>
                      <p style={{ fontSize: '12px', color: '#ef4444', marginBottom: '8px', fontWeight: 500 }}>
                        Points d'attention :
                      </p>
                      <ul className="single-course-panel__list single-course-panel__list--bullets" style={{ marginBottom: '12px' }}>
                        {analysis.issues.map((issue) => (
                          <li key={issue} style={{ color: '#ef4444', fontSize: '12px' }}>
                            {issue}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {analysis.strengths.length > 0 && (
                    <div style={{ marginBottom: '12px' }}>
                      <p style={{ fontSize: '12px', color: '#22c55e', marginBottom: '8px', fontWeight: 500 }}>
                        Points forts :
                      </p>
                      <ul className="single-course-panel__list single-course-panel__list--bullets" style={{ marginBottom: '12px' }}>
                        {analysis.strengths.map((strength) => (
                          <li key={strength} style={{ color: '#22c55e', fontSize: '12px' }}>
                            {strength}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  <ul className="single-course-panel__list single-course-panel__list--bullets">
                    {analysis.recommendations.map((rec) => (
                      <li key={rec}>{rec}</li>
                    ))}
                  </ul>
                  <p className="single-course-panel__objective">
                    objectif prochain mois :{' '}
                    <strong>
                      {metrics?.targetDPlusPerWeek ? `> ${metrics.targetDPlusPerWeek} m d+ / semaine` : 'à définir'}
                    </strong>
                  </p>
                </div>
              </div>
            </div>
          </section>
        </main>
      </div>
    </div>
  )
}
