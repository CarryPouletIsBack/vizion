import './EventsPage.css'

import { useMemo, useState } from 'react'

import HeaderTopBar from '../components/HeaderTopBar'
import EventsColumnFilteringChart from '../components/EventsColumnFilteringChart'

type EventsPageProps = {
  onNavigate?: (view: 'saison' | 'events' | 'courses' | 'course') => void
  events: Array<{
    id: string
    name: string
    country: string
    startLabel: string
    imageUrl?: string
    courses: Array<{ id: string; name: string }>
  }>
  onEventSelect?: (eventId: string) => void
}

export default function EventsPage({ onNavigate, events, onEventSelect }: EventsPageProps) {
  const [countryFilter, setCountryFilter] = useState('Tous')
  const [dateFilter, setDateFilter] = useState('Toutes')

  const countryOptions = useMemo(() => {
    const countries = Array.from(new Set(events.map((event) => event.country)))
    return ['Tous', ...countries]
  }, [events])

  const dateOptions = useMemo(() => {
    const dates = Array.from(new Set(events.map((event) => event.startLabel)))
    return ['Toutes', ...dates]
  }, [events])

  const filteredEvents = useMemo(() => {
    return events.filter((event) => {
      const matchesCountry = countryFilter === 'Tous' || event.country === countryFilter
      const matchesDate = dateFilter === 'Toutes' || event.startLabel === dateFilter
      return matchesCountry && matchesDate
    })
  }, [events, countryFilter, dateFilter])
  return (
    <div className="events-page">
      <HeaderTopBar />

      <div className="events-body">
        <aside className="events-side">
          <nav className="events-nav">
            <button className="events-nav__item" type="button" onClick={() => onNavigate?.('saison')}>
              Saison
            </button>
            <button className="events-nav__item events-nav__item--active" type="button">
              Événements
            </button>
            <div className="events-nav__favorites">
              <p>Grand Raid</p>
              <p>UTOI</p>
              <p>UTMB</p>
            </div>
            <button className="events-nav__item" type="button" onClick={() => onNavigate?.('courses')}>
              Courses
            </button>
            <button className="events-nav__item" type="button">
              Infos
            </button>
          </nav>
        </aside>

        <main className="events-main">
          <section className="events-header">
            <div className="events-header__title">
              <p className="events-title">Événements</p>
              <p className="events-subtitle">13 événements</p>
            </div>
            <label className="events-search" htmlFor="events-search">
              <span className="events-search__icon" aria-hidden="true">
                🔍
              </span>
              <input id="events-search" type="text" placeholder="Rechercher un événement" />
            </label>
          </section>

          <section className="events-actions">
            <label className="events-filter">
              Pays
              <select value={countryFilter} onChange={(event) => setCountryFilter(event.target.value)}>
                {countryOptions.map((country) => (
                  <option key={country} value={country}>
                    {country}
                  </option>
                ))}
              </select>
            </label>
            <label className="events-filter">
              Date
              <select value={dateFilter} onChange={(event) => setDateFilter(event.target.value)}>
                {dateOptions.map((date) => (
                  <option key={date} value={date}>
                    {date}
                  </option>
                ))}
              </select>
            </label>
            <div className="events-actions__spacer" />
            <button className="events-view" type="button" aria-label="Vue cartes">
              ▦
            </button>
          </section>

          <section className="events-table">
            <EventsColumnFilteringChart
              events={filteredEvents}
              onEventSelect={(eventId) => {
                onEventSelect?.(eventId)
              }}
            />
          </section>
        </main>
      </div>

    </div>
  )
}
