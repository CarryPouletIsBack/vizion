import { useEffect, useRef, useState } from 'react'
import { MapContainer, TileLayer, Polyline, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import './SegmentMapLeaflet.css'

export type SegmentMapLeafletProps = {
  /** Points du segment [lat, lng] pour Leaflet */
  segmentPositions: Array<[number, number]>
  /** Hauteur du conteneur (ex. "280px") */
  height?: string
}

function FitBounds({ positions }: { positions: Array<[number, number]> }) {
  const map = useMap()
  useEffect(() => {
    if (!positions.length) return
    if (positions.length === 1) {
      map.setView(positions[0], 14)
      return
    }
    const bounds = L.latLngBounds(positions)
    map.fitBounds(bounds, { padding: [24, 24], maxZoom: 15 })
  }, [map, positions])
  return null
}

/** Recalcule la taille de la carte après layout pour que les tuiles OSM se chargent */
function MapResizeHandler() {
  const map = useMap()
  useEffect(() => {
    const t1 = setTimeout(() => map.invalidateSize(), 50)
    const t2 = setTimeout(() => map.invalidateSize(), 300)
    return () => {
      clearTimeout(t1)
      clearTimeout(t2)
    }
  }, [map])
  return null
}

export default function SegmentMapLeaflet({
  segmentPositions,
  height = '280px',
}: SegmentMapLeafletProps) {
  const wrapperRef = useRef<HTMLDivElement>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let cancelled = false
    let timeoutId: ReturnType<typeof setTimeout>
    const rafId = requestAnimationFrame(() => {
      if (cancelled) return
      timeoutId = setTimeout(() => {
        if (!cancelled) setReady(true)
      }, 80)
    })
    const forceId = setTimeout(() => {
      if (!cancelled) setReady(true)
    }, 400)
    return () => {
      cancelled = true
      cancelAnimationFrame(rafId)
      clearTimeout(timeoutId)
      clearTimeout(forceId)
    }
  }, [])

  if (!segmentPositions.length) {
    return (
      <div className="segment-map-leaflet segment-map-leaflet--empty" style={{ height }}>
        <p>Aucun point pour ce segment</p>
      </div>
    )
  }

  const center = segmentPositions[Math.floor(segmentPositions.length / 2)]

  return (
    <div
      ref={wrapperRef}
      className="segment-map-leaflet"
      style={{ height, width: '100%' }}
    >
      {ready ? (
        <MapContainer
          center={center}
          zoom={12}
          style={{ height: '100%', width: '100%', minHeight: 280 }}
          zoomControl={true}
          scrollWheelZoom={true}
          doubleClickZoom={true}
          dragging={true}
          className="segment-map-leaflet__container"
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
            url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
            maxZoom={20}
          />
          <Polyline
            positions={segmentPositions}
            pathOptions={{
              color: '#bfc900',
              weight: 5,
              opacity: 1,
            }}
          />
          <FitBounds positions={segmentPositions} />
          <MapResizeHandler />
        </MapContainer>
      ) : (
        <div className="segment-map-leaflet__placeholder" style={{ height: '100%', width: '100%' }} aria-hidden />
      )}
    </div>
  )
}
