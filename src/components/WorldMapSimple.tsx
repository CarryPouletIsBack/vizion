// @ts-nocheck
import { memo, useMemo, useState } from 'react'
import { Annotation, ComposableMap, Geographies, Geography, Marker } from 'react-simple-maps'

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

  const mapTags = useMemo<MapTag[]>(
    () => [
      { id: 'france', label: '2', flag: franceFlag, coordinates: [2.2137, 46.2276] },
      { id: 'madagascar', label: '3', flag: madagascarFlag, coordinates: [46.8691, -18.7669] },
      { id: 'reunion', label: '+10', flag: reunionFlag, coordinates: [55.5364, -21.1151] },
    ],
    []
  )

  const handleTagClick = (tag: MapTag) => {
    setActiveTagId(tag.id)
  }

  const activeTag = mapTags.find((tag) => tag.id === activeTagId) ?? null

  return (
    <div className="world-map-simple">
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

        {mapTags.map((tag) => (
          <Marker key={tag.id} coordinates={tag.coordinates}>
            <foreignObject x={-24} y={-12} width={64} height={28} style={{ overflow: 'visible' }}>
              <div xmlns="http://www.w3.org/1999/xhtml" style={{ width: '100%', height: '100%' }}>
                <button
                  type="button"
                  className="map-tag"
                  onClick={() => handleTagClick(tag)}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '2px 4px',
                    borderRadius: '8px',
                    background: 'var(--color-bg-surface, #161b21)',
                    backdropFilter: 'blur(25px)',
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
                    zIndex: 10,
                  }}
                >
                  <span className="map-tag__flag" style={{ display: 'inline-block', width: '12px', height: '12px', borderRadius: '50%', overflow: 'hidden', flexShrink: 0 }}>
                    <img src={tag.flag} alt="" aria-hidden="true" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                  </span>
                  <span>{tag.label}</span>
                </button>
              </div>
            </foreignObject>
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
      </ComposableMap>
    </div>
  )
})

export default WorldMapSimple
