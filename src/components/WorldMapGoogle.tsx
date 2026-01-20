// @ts-nocheck
import { memo, useMemo, useState, useEffect, useCallback } from 'react'
import { GoogleMap, Marker, InfoWindow, useJsApiLoader } from '@react-google-maps/api'

import franceFlag from '../assets/0d2a1183d2a0d185452acf52145cc62ece475c35.png'
import madagascarFlag from '../assets/368baee8720e10132672b44dafc4f6648780c5e9.png'
import reunionFlag from '../assets/5375c6ef182ea756eeb23fb723865d5c353eb10b.png'
import grandRaidLogo from '../assets/da2a1ce5e69564e56a29b5912fd151a8f515e136.png'
import gpxIcon from '../assets/d824ad10b22406bc6f779da5180da5cdaeca1e2c.svg'
import { supabase, type CourseRow } from '../lib/supabase'
import './WorldMapGoogle.css'

type WorldMapGoogleProps = {
  onCourseSelect?: () => void
}

type MapTag = {
  id: string
  label: string
  flag: string
  coordinates: { lat: number; lng: number }
  course?: CourseRow
}

// Configuration par défaut de la carte
const mapContainerStyle = {
  width: '100%',
  height: '100%',
}

const defaultCenter = {
  lat: 20,
  lng: 0,
}

const defaultZoom = 2

// Configuration de la carte Google Maps
const mapOptions = {
  disableDefaultUI: false,
  zoomControl: true,
  streetViewControl: false,
  mapTypeControl: false,
  fullscreenControl: false,
}

const WorldMapGoogle = memo(function WorldMapGoogle({ onCourseSelect }: WorldMapGoogleProps) {
  const [activeTagId, setActiveTagId] = useState<string | null>(null)
  const [mapCenter, setMapCenter] = useState<{ lat: number; lng: number }>(defaultCenter)
  const [mapZoom, setMapZoom] = useState(defaultZoom)
  const [courses, setCourses] = useState<CourseRow[]>([])
  const [map, setMap] = useState<google.maps.Map | null>(null)

  // Clé API Google Maps - À configurer via variable d'environnement
  const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || ''

  const { isLoaded, loadError } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: GOOGLE_MAPS_API_KEY,
    libraries: ['geometry'],
  })

  // Charger les courses depuis Supabase
  useEffect(() => {
    const loadCourses = async () => {
      try {
        const { data, error } = await supabase
          .from('courses')
          .select('*')
          .not('start_coordinates', 'is', null)

        if (error) {
          if (error.code !== 'PGRST116' && error.code !== '42501' && error.code !== 'PGRST301') {
            console.error('Erreur lors du chargement des courses:', error)
          }
          return
        }

        if (data) {
          setCourses(data as CourseRow[])
        }
      } catch (err) {
        console.warn('Impossible de charger les courses (utilisateur non connecté?)', err)
      }
    }

    loadCourses()
  }, [])

  // Créer les map tags depuis les courses avec coordonnées GPX
  const mapTags = useMemo<MapTag[]>(() => {
    const tags: MapTag[] = []
    
    courses.forEach((course, index) => {
      if (course.start_coordinates && course.start_coordinates.length === 2) {
        const [lat, lon] = course.start_coordinates
        tags.push({
          id: course.id,
          label: String(index + 1),
          flag: reunionFlag,
          coordinates: { lat, lng: lon },
          course: course,
        })
      }
    })

    return tags
  }, [courses])

  const handleTagClick = useCallback((tag: MapTag) => {
    setActiveTagId(tag.id)
    setMapCenter(tag.coordinates)
    setMapZoom(6)
  }, [])

  const handleMapClick = useCallback((e: google.maps.MapMouseEvent) => {
    if (e.latLng) {
      const lat = e.latLng.lat()
      const lng = e.latLng.lng()
      if (map) {
        const currentZoom = map.getZoom() || defaultZoom
        map.panTo({ lat, lng })
        map.setZoom(Math.min(6, currentZoom + 1))
      }
    }
  }, [map])

  const onMapLoad = useCallback((mapInstance: google.maps.Map) => {
    setMap(mapInstance)
  }, [])

  const activeTag = mapTags.find((tag) => tag.id === activeTagId) ?? null

  // Créer une icône personnalisée pour chaque tag
  const createCustomIcon = useCallback((tag: MapTag) => {
    return {
      url: 'data:image/svg+xml;base64,' + btoa(`
        <svg xmlns="http://www.w3.org/2000/svg" width="60" height="28" viewBox="0 0 60 28">
          <foreignObject width="60" height="28">
            <div xmlns="http://www.w3.org/1999/xhtml" class="map-tag-container" style="display: flex; flex-direction: column; align-items: center;">
              <div class="map-tag-pin" style="width: 8px; height: 8px; border-radius: 50%; background: #bfc900; border: 2px solid #0b0e11; margin-bottom: 4px;"></div>
              <button class="map-tag-button" style="display: inline-flex; align-items: center; gap: 6px; padding: 2px 4px; border-radius: 8px; background: #161b21; backdrop-filter: blur(25px); border: 0.5px solid rgba(42, 46, 26, 0.2); font-size: 11px; letter-spacing: 1.43px; color: #e5e7eb; cursor: pointer; font-family: inherit; margin: 0; outline: none; white-space: nowrap; box-sizing: border-box;">
                <img src="${tag.flag}" alt="" style="width: 12px; height: 12px; border-radius: 50%; object-fit: cover; display: block;" />
                <span>${tag.label}</span>
              </button>
            </div>
          </foreignObject>
        </svg>
      `),
      scaledSize: new google.maps.Size(60, 28),
      anchor: new google.maps.Point(30, 14),
    }
  }, [])

  if (loadError) {
    return (
      <div className="world-map-google">
        <div className="map-error">
          <p>Erreur lors du chargement de Google Maps. Veuillez vérifier votre clé API.</p>
          <p style={{ fontSize: '12px', color: '#9ca3af', marginTop: '8px' }}>
            Configurez VITE_GOOGLE_MAPS_API_KEY dans votre fichier .env
          </p>
        </div>
      </div>
    )
  }

  if (!isLoaded) {
    return (
      <div className="world-map-google">
        <div className="map-loading">Chargement de la carte...</div>
      </div>
    )
  }

  return (
    <div className="world-map-google">
      <GoogleMap
        mapContainerStyle={mapContainerStyle}
        center={mapCenter}
        zoom={mapZoom}
        options={mapOptions}
        onLoad={onMapLoad}
        onClick={handleMapClick}
      >
        {mapTags.map((tag) => (
          <Marker
            key={tag.id}
            position={tag.coordinates}
            icon={createCustomIcon(tag)}
            onClick={() => handleTagClick(tag)}
          >
            {activeTag?.id === tag.id && tag.course && (
              <InfoWindow
                position={tag.coordinates}
                onCloseClick={() => setActiveTagId(null)}
              >
                <article
                  className="course-card map-course-card"
                  role="button"
                  tabIndex={0}
                  onClick={onCourseSelect}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      onCourseSelect?.()
                    }
                  }}
                >
                  <div className="course-card__top">
                    <div className="course-card__gpx">
                      {tag.course.gpx_svg ? (
                        <div
                          className="course-card__gpx-svg"
                          dangerouslySetInnerHTML={{ __html: tag.course.gpx_svg }}
                        />
                      ) : (
                        <img src={gpxIcon} alt="GPX" />
                      )}
                    </div>
                    <div className="course-card__content">
                      <h3 className="course-card__title">{tag.course.name}</h3>
                      <p className="course-card__stats">
                        {tag.course.distance_km && tag.course.elevation_gain
                          ? `${Math.round(tag.course.distance_km)} km – ${Math.round(tag.course.elevation_gain)} D+`
                          : 'Course'}
                      </p>
                    </div>
                  </div>
                  <footer className="course-card__footer">
                    <div className="course-card__footer-left">
                      <p>
                        État de préparation : <strong>—</strong>
                      </p>
                    </div>
                    <div className="course-card__footer-right">
                      <p>Début de la course</p>
                      <p className="course-card__countdown">À venir</p>
                    </div>
                  </footer>
                </article>
              </InfoWindow>
            )}
          </Marker>
        ))}
      </GoogleMap>
    </div>
  )
})

export default WorldMapGoogle
