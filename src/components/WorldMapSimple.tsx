// @ts-nocheck
import { memo, useMemo, useRef, useState, useEffect } from 'react'
import { geoMercator } from 'd3-geo'
import { Annotation, ComposableMap, Geographies, Geography } from 'react-simple-maps'

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
  const [activeTagId, setActiveTagId] = useState<string | null>(null)
  const [tagPositions, setTagPositions] = useState<Map<string, { x: number; y: number }>>(new Map())
  const containerRef = useRef<HTMLDivElement | null>(null)

  const mapTags = useMemo<MapTag[]>(
    () => [
      { id: 'france', label: '2', flag: franceFlag, coordinates: [2.2137, 46.2276] },
      { id: 'madagascar', label: '3', flag: madagascarFlag, coordinates: [46.8691, -18.7669] },
      { id: 'reunion', label: '+10', flag: reunionFlag, coordinates: [55.5364, -21.1151] },
    ],
    []
  )

  // Projection identique à celle utilisée par ComposableMap
  const projection = useMemo(() => {
    return geoMercator()
      .scale(145)
      .center([0, 18])
  }, [])

  // Calculer les positions des tags en pixels
  useEffect(() => {
    const updatePositions = () => {
      if (!containerRef.current) return

      const container = containerRef.current
      const rect = container.getBoundingClientRect()
      const width = rect.width
      const height = rect.height

      // Ajuster la projection à la taille du container
      projection.translate([width / 2, height / 2])

      const positions = new Map<string, { x: number; y: number }>()

      mapTags.forEach((tag) => {
        const projected = projection(tag.coordinates)
        if (projected && projected[0] !== null && projected[1] !== null) {
          positions.set(tag.id, {
            x: projected[0],
            y: projected[1],
          })
        }
      })

      setTagPositions(positions)
    }

    // Mettre à jour les positions au montage et au redimensionnement
    const timeoutId = setTimeout(updatePositions, 100) // Petit délai pour laisser le SVG se rendre
    window.addEventListener('resize', updatePositions)

    return () => {
      clearTimeout(timeoutId)
      window.removeEventListener('resize', updatePositions)
    }
  }, [mapTags, projection])

  const handleTagClick = (tag: MapTag) => {
    setActiveTagId(tag.id)
  }

  const activeTag = mapTags.find((tag) => tag.id === activeTagId) ?? null

  return (
    <div className="world-map-simple" ref={containerRef}>
      <ComposableMap
        projection="geoMercator"
        projectionConfig={{ scale: 145, center: [0, 18] }}
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
                style={{
                  default: { outline: 'none', cursor: 'default' },
                  hover: { outline: 'none', cursor: 'default' },
                  pressed: { outline: 'none', cursor: 'default' },
                }}
              />
            ))
          }
        </Geographies>

        {activeTag && (
          <Annotation subject={activeTag.coordinates} dx={32} dy={-20} connectorProps={{ stroke: 'none' }}>
            <foreignObject x={0} y={-140} width={292} height={180} style={{ overflow: 'visible' }}>
              <div xmlns="http://www.w3.org/1999/xhtml">
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
              </div>
            </foreignObject>
          </Annotation>
        )}
      </ComposableMap>

      {/* Tags positionnés en HTML absolu au-dessus du SVG */}
      {mapTags.map((tag) => {
        const position = tagPositions.get(tag.id)
        if (!position) return null

        return (
          <button
            key={tag.id}
            type="button"
            className="map-tag map-tag--absolute"
            onClick={() => handleTagClick(tag)}
            style={{
              position: 'absolute',
              left: `${position.x}px`,
              top: `${position.y}px`,
              transform: 'translate(-50%, -50%)',
            }}
          >
            <span className="map-tag__flag">
              <img src={tag.flag} alt="" aria-hidden="true" />
            </span>
            <span>{tag.label}</span>
          </button>
        )
      })}
    </div>
  )
})

export default WorldMapSimple
