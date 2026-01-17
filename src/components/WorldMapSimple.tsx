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
  const [position, setPosition] = useState({ coordinates: [0, 0] as [number, number], zoom: 1.35 })
  const [activeTagId, setActiveTagId] = useState<string | null>(null)
  const mapContainerRef = useRef<HTMLDivElement | null>(null)

  const mapTags = useMemo<MapTag[]>(
    () => [
      { id: 'france', label: '2', flag: franceFlag, coordinates: [2.2137, 46.2276] },
      { id: 'madagascar', label: '3', flag: madagascarFlag, coordinates: [46.8691, -18.7669] },
      { id: 'reunion', label: '+10', flag: reunionFlag, coordinates: [55.5364, -21.1151] },
    ],
    []
  )

  const handleTagClick = (tag: MapTag, event?: React.MouseEvent) => {
    event?.stopPropagation()
    // Afficher la card ET zoomer
    setActiveTagId(tag.id)
    setPosition({
      coordinates: tag.coordinates,
      zoom: Math.min(6, Math.max(2.5, position.zoom + 1.5)),
    })
  }

  const handleGeographyClick = (geo: GeoJSON.Feature, event: React.MouseEvent<SVGPathElement>) => {
    event.stopPropagation()
    
    // Calculer les coordonnées du point cliqué
    const svgElement = event.currentTarget.ownerSVGElement
    if (!svgElement || !mapContainerRef.current) {
      // Fallback sur le centroid
      const [longitude, latitude] = geoCentroid(geo)
      setPosition({
        coordinates: [longitude, latitude],
        zoom: Math.min(6, Math.max(2.5, position.zoom + 1)),
      })
      return
    }

    // Obtenir les dimensions du SVG
    const svgRect = svgElement.getBoundingClientRect()
    const containerRect = mapContainerRef.current.getBoundingClientRect()
    
    // Coordonnées du clic dans le SVG (relatives au viewport)
    const clickX = event.clientX - svgRect.left
    const clickY = event.clientY - svgRect.top
    
    // Trouver le groupe de projection transformé
    const projectionGroup = svgElement.querySelector('g[class*="rsm-zoomable-group"]')
    if (!projectionGroup) {
      const [longitude, latitude] = geoCentroid(geo)
      setPosition({
        coordinates: [longitude, latitude],
        zoom: Math.min(6, Math.max(2.5, position.zoom + 1)),
      })
      return
    }

    // Obtenir la transformation actuelle
    const transform = projectionGroup.getAttribute('transform') || ''
    const translateMatch = transform.match(/translate\(([^,]+),([^)]+)\)/)
    const scaleMatch = transform.match(/scale\(([^)]+)\)/)
    
    const currentTranslateX = translateMatch ? parseFloat(translateMatch[1]) : 0
    const currentTranslateY = translateMatch ? parseFloat(translateMatch[2]) : 0
    const currentScale = scaleMatch ? parseFloat(scaleMatch[1]) : position.zoom

    // Coordonnées dans l'espace du groupe transformé
    const groupX = (clickX - svgRect.width / 2 - currentTranslateX) / currentScale
    const groupY = (clickY - svgRect.height / 2 - currentTranslateY) / currentScale

    // Utiliser la projection inverse pour convertir en coordonnées géographiques
    const projection = geoMercator()
      .scale(145)
      .center([0, 18])
      .translate([svgRect.width / 2, svgRect.height / 2])

    const coords = projection.invert([groupX + svgRect.width / 2, groupY + svgRect.height / 2])
    
    if (coords && coords[0] !== null && coords[1] !== null) {
      setPosition({
        coordinates: [coords[0], coords[1]],
        zoom: Math.min(6, Math.max(2.5, position.zoom + 1)),
      })
    } else {
      // Fallback sur le centroid
      const [longitude, latitude] = geoCentroid(geo)
      setPosition({
        coordinates: [longitude, latitude],
        zoom: Math.min(6, Math.max(2.5, position.zoom + 1)),
      })
    }
  }

  const activeTag = mapTags.find((tag) => tag.id === activeTagId) ?? null

  return (
    <div className="world-map-simple" ref={mapContainerRef}>
      <ComposableMap
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
              geographies.map((geo) => {
                const [longitude, latitude] = geoCentroid(geo)
                const name = geo.properties?.NAME || geo.properties?.name || geo.properties?.NAME_LONG || ''
                
                return (
                  <g key={geo.rsmKey}>
                    <Geography
                      geography={geo}
                      fill="var(--color-text-primary, #e5e7eb)"
                      stroke="var(--color-border-default, #2a3038)"
                      strokeWidth={0.6}
                      onClick={(event) => handleGeographyClick(geo, event)}
                      style={{
                        default: { outline: 'none', cursor: 'pointer' },
                        hover: { 
                          outline: 'none', 
                          cursor: 'pointer',
                          fill: 'var(--color-accent, #bfc900)',
                          opacity: 0.7,
                        },
                        pressed: { outline: 'none', cursor: 'pointer' },
                      }}
                    />
                    {/* Afficher le nom du pays */}
                    {name && position.zoom > 1.5 && (
                      <text
                        x={longitude}
                        y={latitude}
                        textAnchor="middle"
                        fontSize={Math.max(8, Math.min(14, position.zoom * 2))}
                        fill="var(--color-text-secondary, #9ca3af)"
                        style={{
                          pointerEvents: 'none',
                          userSelect: 'none',
                        }}
                      >
                        {name}
                      </text>
                    )}
                  </g>
                )
              })
            }
          </Geographies>

          {mapTags.map((tag) => (
            <Marker key={tag.id} coordinates={tag.coordinates}>
              <g>
                <circle
                  r={4}
                  fill="var(--color-accent, #bfc900)"
                  stroke="var(--color-bg-primary, #0b0e11)"
                  strokeWidth={1}
                  style={{ cursor: 'pointer' }}
                  onClick={(e) => handleTagClick(tag, e)}
                />
                <foreignObject 
                  x={-30} 
                  y={-14} 
                  width={60} 
                  height={28}
                  requiredExtensions="http://www.w3.org/1999/xhtml"
                  style={{ 
                    overflow: 'visible',
                    pointerEvents: 'auto',
                  }}
                >
                  <div 
                    xmlns="http://www.w3.org/1999/xhtml" 
                    style={{ 
                      width: '100%', 
                      height: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      pointerEvents: 'auto',
                    }}
                  >
                    <button
                      type="button"
                      className="map-tag"
                      onClick={(e) => handleTagClick(tag, e)}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '2px 4px',
                        borderRadius: '8px',
                        background: 'var(--color-bg-surface, #161b21)',
                        backdropFilter: 'blur(25px)',
                        WebkitBackdropFilter: 'blur(25px)',
                        border: '0.5px solid rgba(42, 46, 26, 0.2)',
                        fontSize: '11px',
                        letterSpacing: '1.43px',
                        color: 'var(--color-text-primary, #e5e7eb)',
                        cursor: 'pointer',
                        fontFamily: 'inherit',
                        margin: 0,
                        outline: 'none',
                        visibility: 'visible',
                        opacity: 1,
                        position: 'relative',
                        transform: 'none',
                        whiteSpace: 'nowrap',
                        boxSizing: 'border-box',
                      }}
                    >
                      <span className="map-tag__flag" style={{ display: 'inline-block', width: '12px', height: '12px', borderRadius: '50%', overflow: 'hidden', flexShrink: 0 }}>
                        <img src={tag.flag} alt="" aria-hidden="true" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                      </span>
                      <span>{tag.label}</span>
                    </button>
                  </div>
                </foreignObject>
              </g>
            </Marker>
          ))}

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
        </ZoomableGroup>
      </ComposableMap>
    </div>
  )
})

export default WorldMapSimple
