// @ts-nocheck
import { memo, useMemo, useRef, useState } from 'react'
import { geoCentroid, geoMercator } from 'd3-geo'
import { Annotation, ComposableMap, Geographies, Geography, Marker, ZoomableGroup } from 'react-simple-maps'

import features from '../data/world-map-features.json'
import franceFlag from '../assets/0d2a1183d2a0d185452acf52145cc62ece475c35.png'
import madagascarFlag from '../assets/368baee8720e10132672b44dafc4f6648780c5e9.png'
import reunionFlag from '../assets/5375c6ef182ea756eeb23fb723865d5c353eb10b.png'
import grandRaidLogo from '../assets/da2a1ce5e69564e56a29b5912fd151a8f515e136.png'
import gpxIcon from '../assets/d824ad10b22406bc6f779da5180da5cdaeca1e2c.svg'
// @ts-nocheck
import './WorldMapSimple.css'

type WorldMapSimpleProps = {
  onCourseSelect?: () => void
}

type MapTag = {
  id: string
  label: string
  flag: string
  coordinates: [number, number]
}

const WorldMapSimple = memo(function WorldMapSimple({ onCourseSelect }: WorldMapSimpleProps) {
  // État du zoom et du déplacement pour permettre l’interaction.
  const [position, setPosition] = useState({ coordinates: [0, 0] as [number, number], zoom: 1.35 })
  const [activeTagId, setActiveTagId] = useState<string | null>(null)
  const svgRef = useRef<SVGSVGElement | null>(null)

  const mapTags = useMemo<MapTag[]>(
    () => [
      { id: 'france', label: '2', flag: franceFlag, coordinates: [2.2137, 46.2276] },
      { id: 'madagascar', label: '3', flag: madagascarFlag, coordinates: [46.8691, -18.7669] },
      { id: 'reunion', label: '+10', flag: reunionFlag, coordinates: [55.5364, -21.1151] },
    ],
    []
  )

  const projection = useMemo(() => {
    return geoMercator().scale(145).center([0, 18])
  }, [])

  const handleGeographyClick = (geo: GeoJSON.Feature, event: React.MouseEvent<SVGPathElement>) => {
    // Zoomer sur la zone cliquée en recentrant la carte.
    let coordinates: [number, number] | null = null

    if (svgRef.current) {
      const rect = svgRef.current.getBoundingClientRect()
      const point: [number, number] = [event.clientX - rect.left, event.clientY - rect.top]
      const inverted = projection.invert(point)
      if (inverted) {
        coordinates = [inverted[0], inverted[1]]
      }
    }

    if (!coordinates) {
      const [longitude, latitude] = geoCentroid(geo)
      coordinates = [longitude, latitude]
    }

    setPosition({
      coordinates,
      zoom: Math.min(6, Math.max(2.2, position.zoom + 1)),
    })
  }

  const handleTagClick = (tag: MapTag) => {
    setActiveTagId(tag.id)
    setPosition({
      coordinates: tag.coordinates,
      zoom: Math.min(6, Math.max(2.2, position.zoom + 1)),
    })
  }

  const activeTag = mapTags.find((tag) => tag.id === activeTagId) ?? null

  return (
    <div className="world-map-simple">
      <ComposableMap
        ref={svgRef}
        projection="geoMercator"
        projectionConfig={{ scale: 145, center: [0, 18] }}
      >
        <ZoomableGroup
          zoom={position.zoom}
          center={position.coordinates}
          minZoom={0.9}
          maxZoom={6}
          onMoveEnd={(nextPosition) => setPosition(nextPosition)}
        >
          <Geographies geography={features}>
            {({ geographies }) =>
              geographies.map((geo) => (
                <Geography
                  key={geo.rsmKey}
                  geography={geo}
                  fill="var(--color-text-primary, #e5e7eb)"
                  stroke="var(--color-border-default, #2a3038)"
                  strokeWidth={0.6}
                  onClick={(event) => handleGeographyClick(geo, event)}
                  style={{
                    default: { outline: 'none', cursor: 'pointer' },
                    hover: { outline: 'none', cursor: 'pointer' },
                    pressed: { outline: 'none', cursor: 'pointer' },
                  }}
                />
              ))
            }
          </Geographies>

          {mapTags.map((tag) => (
            <Marker key={tag.id} coordinates={tag.coordinates}>
              <foreignObject x={-24} y={-12} width={64} height={28}>
                <button
                  type="button"
                  className="map-tag"
                  onClick={() => handleTagClick(tag)}
                >
                  <span className="map-tag__flag">
                    <img src={tag.flag} alt="" aria-hidden="true" />
                  </span>
                  <span>{tag.label}</span>
                </button>
              </foreignObject>
            </Marker>
          ))}

          {activeTag && (
            <Annotation subject={activeTag.coordinates} dx={32} dy={-20} connectorProps={{ stroke: 'none' }}>
              <foreignObject x={0} y={-140} width={292} height={180}>
                <button type="button" className="map-card" onClick={onCourseSelect}>
                  <div className="map-card__media">
                    <img src={grandRaidLogo} alt="Grand raid" />
                  </div>
                  <div className="map-card__heading">
                    <span>Grand raid</span>
                    <span>2026</span>
                    <span className="map-card__flag">
                      <img src={reunionFlag} alt="Drapeau de La Reunion" />
                    </span>
                  </div>
                  <div className="map-card__info">
                    <div className="map-card__details">
                      <p>Diagonale des fous</p>
                      <p>165 km – 9 800 D+</p>
                    </div>
                    <img className="map-card__gpx" src={gpxIcon} alt="GPX" />
                  </div>
                  <div className="map-card__footer">
                    <div className="map-card__footer-col">
                      <p>État de préparation : 62%</p>
                    </div>
                    <div className="map-card__footer-col">
                      <p>Début de la course</p>
                      <p className="map-card__countdown">6 mois</p>
                    </div>
                  </div>
                </button>
              </foreignObject>
            </Annotation>
          )}
        </ZoomableGroup>
      </ComposableMap>
    </div>
  )
})

export default WorldMapSimple
