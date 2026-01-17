import './CoursesPage.css'

import reunionFlag from '../assets/5375c6ef182ea756eeb23fb723865d5c353eb10b.png'
import gpxIcon from '../assets/d824ad10b22406bc6f779da5180da5cdaeca1e2c.svg'
import grandRaidLogo from '../assets/da2a1ce5e69564e56a29b5912fd151a8f515e136.png'
import HeaderTopBar from '../components/HeaderTopBar'
import SideNav from '../components/SideNav'

type CoursesPageProps = {
  onNavigate?: (view: 'saison' | 'events' | 'courses' | 'course') => void
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
}

export default function CoursesPage({
  onNavigate,
  onSelectCourse,
  events,
  selectedEventId,
}: CoursesPageProps) {
  const selectedEvent = events.find((event) => event.id === selectedEventId) ?? events[0]
  const courseCards =
    selectedEvent?.courses
      .filter((course) => course.name.trim().toLowerCase() !== 'sans titre')
      .map((course, index) => ({
      id: course.id,
      title: selectedEvent.name,
      year: '2026',
      subtitle: course.name,
      stats:
        course.distanceKm && course.elevationGain
          ? `${course.distanceKm.toFixed(0)} km – ${Math.round(course.elevationGain)} D+`
          : '165 km – 9 800 D+',
      readiness: '62%',
      countdown: '6 mois',
      imageUrl: course.imageUrl ?? selectedEvent.imageUrl ?? grandRaidLogo,
      gpxName: course.gpxName,
      gpxSvg: course.gpxSvg,
      isFirst: index === 0,
      })) ?? []
  return (
    <div className="courses-page">
      <HeaderTopBar onNavigate={onNavigate} />

      <div className="courses-body">
        <aside className="courses-side">
          <SideNav activeItem="courses" onNavigate={onNavigate} />
        </aside>

        <main className="courses-main">
          <section className="courses-header">
            <div className="courses-header__title">
              <p>{selectedEvent?.name?.toUpperCase() ?? 'COURSES'}</p>
              <span className="courses-header__flag">
                <img src={reunionFlag} alt="" aria-hidden="true" />
              </span>
            </div>
            <p className="courses-header__subtitle">
              {selectedEvent ? `${selectedEvent.courses.length} courses` : '0 course'}
            </p>
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
                <header className="course-card__header">
                  <span>{card.title}</span>
                  <span>{card.year}</span>
                  <span className="course-card__flag">
                    <img src={reunionFlag} alt="" aria-hidden="true" />
                  </span>
                </header>
                <div className="course-card__image">
                  <img src={card.imageUrl} alt="Grand Raid" />
                </div>
                <div className="course-card__content">
                  <div>
                    <p>{card.subtitle}</p>
                    <p>{card.stats}</p>
                  </div>
                  <div className="course-card__gpx">
                    {card.gpxSvg ? (
                      <div
                        className="course-card__gpx-svg"
                        dangerouslySetInnerHTML={{ __html: card.gpxSvg }}
                      />
                    ) : (
                      <img src={gpxIcon} alt="GPX" />
                    )}
                    {card.gpxName && <p className="course-card__gpx-name">{card.gpxName}</p>}
                  </div>
                </div>
                <footer className="course-card__footer">
                  <div>
                    <p>
                      État de préparation : <strong>{card.readiness}</strong>
                    </p>
                  </div>
                  <div>
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
