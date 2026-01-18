// @ts-nocheck
import { memo, useMemo, useState, useEffect } from 'react'
import { MapContainer, TileLayer, Marker, Popup, useMap, GeoJSON } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

import franceFlag from '../assets/0d2a1183d2a0d185452acf52145cc62ece475c35.png'
import madagascarFlag from '../assets/368baee8720e10132672b44dafc4f6648780c5e9.png'
import reunionFlag from '../assets/5375c6ef182ea756eeb23fb723865d5c353eb10b.png'
import grandRaidLogo from '../assets/da2a1ce5e69564e56a29b5912fd151a8f515e136.png'
import gpxIcon from '../assets/d824ad10b22406bc6f779da5180da5cdaeca1e2c.svg'
import { supabase, type CourseRow } from '../lib/supabase'
import './WorldMapLeaflet.css'

// Import du TopoJSON des continents et conversion en GeoJSON
import worldTopoJson from '../data/world-map-features.json'
import * as topojson from 'topojson-client'

// Convertir TopoJSON en GeoJSON avec gestion d'erreur robuste
let worldGeoJson: any = null
try {
  if (worldTopoJson && typeof worldTopoJson === 'object') {
    const topo = worldTopoJson as any
    if (topo.type === 'Topology' && topo.objects && topo.objects.world) {
      const converted = topojson.feature(topo, topo.objects.world)
      // Vérifier que la conversion a réussi et que le résultat est valide
      if (converted && converted.type === 'FeatureCollection' && Array.isArray(converted.features)) {
        worldGeoJson = converted
      } else {
        console.warn('Conversion TopoJSON échouée, résultat invalide:', converted)
        worldGeoJson = null
      }
    } else if (topo.type === 'FeatureCollection' && Array.isArray(topo.features)) {
      // Déjà un GeoJSON valide
      worldGeoJson = topo
    } else if (topo.type === 'Feature') {
      // Feature unique, créer une FeatureCollection
      worldGeoJson = {
        type: 'FeatureCollection',
        features: [topo]
      }
    } else {
      console.warn('Format de données inconnu pour world-map-features.json:', topo.type)
      worldGeoJson = null
    }
  }
} catch (error) {
  console.error('Erreur lors de la conversion TopoJSON en GeoJSON:', error)
  worldGeoJson = null
}

// Fix pour les icônes Leaflet par défaut
delete (L.Icon.Default.prototype as any)._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
})

type WorldMapLeafletProps = {
  onCourseSelect?: () => void
}

type MapTag = {
  id: string
  label: string
  flag: string
  coordinates: [number, number] // [lat, lng] pour Leaflet
  course?: CourseRow
}

// Composant pour gérer le zoom au clic sur la carte
function MapClickHandler({ onMapClick }: { onMapClick: (lat: number, lng: number) => void }) {
  const map = useMap()

  useEffect(() => {
    const handleClick = (e: L.LeafletMouseEvent) => {
      // Zoomer sur le point cliqué
      map.flyTo(e.latlng, Math.min(6, map.getZoom() + 1), {
        duration: 0.5,
      })
      onMapClick(e.latlng.lat, e.latlng.lng)
    }

    map.on('click', handleClick)
    return () => {
      map.off('click', handleClick)
    }
  }, [map, onMapClick])

  return null
}

// Composant pour gérer le zoom automatique quand mapCenter change
function MapZoomHandler({ center, zoom }: { center: [number, number]; zoom: number }) {
  const map = useMap()

  useEffect(() => {
    map.flyTo(center, zoom, {
      duration: 0.5,
    })
  }, [map, center, zoom])

  return null
}

const WorldMapLeaflet = memo(function WorldMapLeaflet({ onCourseSelect }: WorldMapLeafletProps) {
  const [activeTagId, setActiveTagId] = useState<string | null>(null)
  const [mapCenter, setMapCenter] = useState<[number, number]>([20, 0]) // [lat, lng]
  const [mapZoom, setMapZoom] = useState(2)
  const [courses, setCourses] = useState<CourseRow[]>([])

  // Charger les courses depuis Supabase
  useEffect(() => {
    const loadCourses = async () => {
      try {
        const { data, error } = await supabase
          .from('courses')
          .select('*')
          .not('start_coordinates', 'is', null)

        if (error) {
          // Ne pas afficher d'erreur si c'est juste une absence de permissions (utilisateur non connecté)
          if (error.code !== 'PGRST116' && error.code !== '42501' && error.code !== 'PGRST301') {
            console.error('Erreur lors du chargement des courses:', error)
          }
          return
        }

        if (data) {
          setCourses(data as CourseRow[])
        }
      } catch (err) {
        // Ignorer les erreurs silencieusement si l'utilisateur n'est pas connecté
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
        // Utiliser le drapeau de La Réunion par défaut (à améliorer avec le pays de l'event)
        tags.push({
          id: course.id,
          label: String(index + 1),
          flag: reunionFlag,
          coordinates: [lat, lon] as [number, number],
          course: course,
        })
      }
    })

    return tags
  }, [courses])

  const handleTagClick = (tag: MapTag) => {
    setActiveTagId(tag.id)
    // Zoomer sur le tag avec animation
    setMapCenter(tag.coordinates)
    setMapZoom(6)
  }

  const handleMapClick = (lat: number, lng: number) => {
    // Le zoom est géré par MapClickHandler
  }

  const activeTag = mapTags.find((tag) => tag.id === activeTagId) ?? null

  // Créer une icône personnalisée pour chaque tag
  const createCustomIcon = (tag: MapTag) => {
    return L.divIcon({
      className: 'custom-marker',
      html: `
        <div class="map-tag-container">
          <div class="map-tag-pin"></div>
          <button class="map-tag-button" data-tag-id="${tag.id}">
            <img src="${tag.flag}" alt="" class="map-tag-flag" />
            <span>${tag.label}</span>
          </button>
        </div>
      `,
      iconSize: [60, 28],
      iconAnchor: [30, 14],
    })
  }

  return (
    <div className="world-map-leaflet">
      <MapContainer
        center={mapCenter}
        zoom={mapZoom}
        style={{ height: '100%', width: '100%' }}
        zoomControl={true}
        scrollWheelZoom={true}
        doubleClickZoom={true}
        dragging={true}
      >
        {/* Tuiles OpenStreetMap complètement masquées pour ne pas afficher les océans */}
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          maxZoom={19}
          opacity={0}
        />
        
        {/* Afficher les continents avec GeoJSON en couleur #E5E7EB */}
        {worldGeoJson && worldGeoJson.type === 'FeatureCollection' && Array.isArray(worldGeoJson.features) && worldGeoJson.features.length > 0 && (
          <GeoJSON
            key="world-continents"
            data={worldGeoJson}
            style={() => ({
              color: 'transparent',
              weight: 0,
              fillColor: '#E5E7EB',
              fillOpacity: 1,
            })}
          />
        )}
        
        <MapClickHandler onMapClick={handleMapClick} />
        <MapZoomHandler center={mapCenter} zoom={mapZoom} />

        {mapTags.map((tag) => (
          <Marker
            key={tag.id}
            position={tag.coordinates}
            icon={createCustomIcon(tag)}
            eventHandlers={{
              click: () => {
                handleTagClick(tag)
              },
            }}
          >
            {activeTag?.id === tag.id && tag.course && (
              <Popup
                position={tag.coordinates}
                className="map-card-popup"
                closeButton={true}
                autoClose={false}
                closeOnClick={false}
                onClose={() => setActiveTagId(null)}
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
              </Popup>
            )}
          </Marker>
        ))}
      </MapContainer>
    </div>
  )
})

export default WorldMapLeaflet
