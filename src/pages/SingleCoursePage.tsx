import './SingleCoursePage.css'

import gpxIcon from '../assets/d824ad10b22406bc6f779da5180da5cdaeca1e2c.svg'
import HeaderTopBar from '../components/HeaderTopBar'
import SingleCourseElevationChart from '../components/SingleCourseElevationChart'
import useGpxHoverMarker from '../hooks/useGpxHoverMarker'
import useStravaMetrics from '../hooks/useStravaMetrics'

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
  const profileData = (selectedCourse as { profile?: Array<[number, number]> } | undefined)?.profile
  const gpxSvg = selectedCourse?.gpxSvg
  const maxDistance = profileData?.length ? profileData[profileData.length - 1][0] : undefined
  useGpxHoverMarker('gpx-inline-svg', maxDistance)
  const { metrics } = useStravaMetrics()
  return (
    <div className="single-course-page">
      <HeaderTopBar />

      <div className="single-course-body">
        <aside className="single-course-side">
          <nav className="single-course-nav">
            <button className="single-course-nav__item single-course-nav__item--active" type="button">
              Saison
            </button>
            <button className="single-course-nav__item" type="button" onClick={() => onNavigate?.('events')}>
              Événements
            </button>
            <button className="single-course-nav__item" type="button" onClick={() => onNavigate?.('courses')}>
              Courses
            </button>
            <button className="single-course-nav__item" type="button">
              Infos
            </button>
          </nav>
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
                          metrics?.regularity === 'bonne' ? ' single-course-panel__pill--ok' : ''
                        }`}
                      >
                        {metrics ? metrics.regularity : '...'}
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
                  <ul className="single-course-panel__list single-course-panel__list--bullets">
                    {(metrics?.recommendations ??
                      ['ajouter 2 sorties > 4h', 'augmenter le travail en descente', 'tester nutrition sur effort long']
                    ).map((rec) => (
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
