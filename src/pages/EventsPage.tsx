import './EventsPage.css'

import { useMemo, useRef, useState } from 'react'
import { HiX } from 'react-icons/hi'

import HeaderTopBar from '../components/HeaderTopBar'
import SideNav from '../components/SideNav'
import EventsColumnFilteringChart from '../components/EventsColumnFilteringChart'

type EventsPageProps = {
  onNavigate?: (view: 'saison' | 'events' | 'courses' | 'course' | 'account') => void
  events: Array<{
    id: string
    name: string
    country: string
    startLabel: string
    imageUrl?: string
    courses: Array<{ id: string; name: string }>
  }>
  onEventSelect?: (eventId: string) => void
  onEventEdit?: (eventId: string) => void
  onEventDelete?: (eventId: string) => void
  onCreateEvent?: (payload: { name: string; imageUrl?: string }) => void
}

export default function EventsPage({ onNavigate, events, onEventSelect, onEventEdit, onEventDelete, onCreateEvent }: EventsPageProps) {
  const [countryFilter, setCountryFilter] = useState('Tous')
  const [dateFilter, setDateFilter] = useState('Toutes')
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const eventNameRef = useRef<HTMLInputElement | null>(null)
  const eventImageRef = useRef<HTMLInputElement | null>(null)

  const handleCreateEvent = () => {
    const name = eventNameRef.current?.value?.trim() || 'Sans titre'
    const file = eventImageRef.current?.files?.[0]
    const imageUrl = file ? URL.createObjectURL(file) : undefined

    onCreateEvent?.({ name, imageUrl })
    setIsCreateModalOpen(false)
    if (eventNameRef.current) eventNameRef.current.value = ''
    if (eventImageRef.current) eventImageRef.current.value = ''
  }

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
      <HeaderTopBar onNavigate={onNavigate} />

      <div className="events-body">
        <aside className="events-side">
          <SideNav activeItem="events" onNavigate={onNavigate} />
        </aside>

        <main className="events-main">
          <section className="events-header">
            <div className="events-header__title">
              <p className="events-title">Événements</p>
              <p className="events-subtitle">13 événements</p>
            </div>
            {onCreateEvent && (
              <button
                className="info-card"
                type="button"
                onClick={() => setIsCreateModalOpen(true)}
              >
                <div>
                  <p className="info-card__title">Ajouter un événement</p>
                  <p className="info-card__subtitle">Créer un nouvel événement pour regrouper vos courses</p>
                </div>
                <span className="info-card__chevron" aria-hidden="true">
                  ›
                </span>
              </button>
            )}
          </section>
          
          <label className="events-search" htmlFor="events-search">
            <span className="events-search__icon" aria-hidden="true">
              🔍
            </span>
            <input id="events-search" type="text" placeholder="Rechercher un événement" />
          </label>

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
              onEventEdit={(eventId) => {
                onEventEdit?.(eventId)
              }}
              onEventDelete={(eventId) => {
                onEventDelete?.(eventId)
              }}
            />
          </section>
        </main>
      </div>

      {isCreateModalOpen && (
        <div className="modal-overlay" role="dialog" aria-modal="true">
          <div className="modal modal--form">
            <header className="modal__header modal__header--center">
              <h2>Crée ton événement</h2>
              <button
                type="button"
                className="modal__close"
                onClick={() => setIsCreateModalOpen(false)}
                aria-label="Fermer"
              >
                <HiX />
              </button>
            </header>
            <p className="modal__subtitle modal__subtitle--left">
              Un événement vous permet de regrouper plusieurs course.
            </p>
            <div className="modal-upload-simple">
              <label className="modal-upload-simple__button" htmlFor="event-image-page">
                <span className="modal-upload-simple__icon">+</span>
                <span className="modal-upload-simple__text">Télécharger une image pour l'événement</span>
              </label>
              <input
                id="event-image-page"
                className="modal-upload-simple__input"
                type="file"
                accept="image/*"
                ref={eventImageRef}
              />
            </div>
            <div className="modal-field">
              <label htmlFor="event-name-page">
                Nom de l'événement<span className="modal-field__required">*</span>
              </label>
              <input
                id="event-name-page"
                className="modal-input"
                type="text"
                placeholder="UTMB"
                ref={eventNameRef}
              />
            </div>
            <p className="modal-footnote">
              En créant un événement tu accepte la charte d'utilisation de communauté.
            </p>
            <div className="modal-actions">
              <button className="modal-back" type="button" onClick={() => setIsCreateModalOpen(false)}>
                Retour
              </button>
              <button className="modal-primary" type="button" onClick={handleCreateEvent}>
                Créer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
