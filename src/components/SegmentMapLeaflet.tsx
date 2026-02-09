import { useEffect, useRef, useState } from 'react'
import { MapContainer, TileLayer, Polyline, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import './SegmentMapLeaflet.css'

/** Leaflet attend [lat, lng]. On garantit l’ordre : si le 1er élément a |v| > 90 (invalide en latitude), on intervertit. */
function toLeafletPositions(positions: Array<[number, number]>): Array<[number, number]> {
  return positions.map(([a, b]) => {
    if (Math.abs(a) > 90 && Math.abs(b) <= 90) return [b, a]
    return [a, b]
  })
}

export type SegmentMapLeafletProps = {
  /** Points du segment actif [lat, lng] à mettre en surbrillance */
  segmentPositions: Array<[number, number]>
  /** Optionnel : tracé complet [lat, lng]. Si fourni, on affiche tout le tracé et on met en avant le segment. */
  fullTrackPositions?: Array<[number, number]>
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
  fullTrackPositions,
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

  const positionsToShow = fullTrackPositions?.length ? fullTrackPositions : segmentPositions
  const hasSegmentHighlight = fullTrackPositions != null && fullTrackPositions.length > 0 && segmentPositions.length > 0
  const leafletFull = toLeafletPositions(fullTrackPositions ?? [])
  const leafletSegment = toLeafletPositions(segmentPositions)
  const leafletToShow = toLeafletPositions(positionsToShow)

  if (!positionsToShow.length) {
    return (
      <div className="segment-map-leaflet segment-map-leaflet--empty" style={{ height }}>
        <p>Aucun point pour ce segment</p>
      </div>
    )
  }

  const center = leafletToShow[Math.floor(leafletToShow.length / 2)]

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
          {hasSegmentHighlight && leafletFull.length > 0 && (
            <Polyline
              positions={leafletFull}
              pathOptions={{
                color: '#6b7280',
                weight: 3,
                opacity: 0.7,
              }}
            />
          )}
          <Polyline
            positions={leafletSegment}
            pathOptions={{
              color: '#bfc900',
              weight: hasSegmentHighlight ? 6 : 5,
              opacity: 1,
            }}
          />
          <FitBounds positions={leafletToShow} />
          <MapResizeHandler />
        </MapContainer>
      ) : (
        <div className="segment-map-leaflet__placeholder" style={{ height: '100%', width: '100%' }} aria-hidden />
      )}
    </div>
  )
}
