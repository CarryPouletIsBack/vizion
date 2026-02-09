import { useEffect, useRef } from 'react'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import './SegmentMapMapbox3D.css'

/** [lat, lon] → [lon, lat] pour GeoJSON Mapbox */
function toLonLat(positions: Array<[number, number]>): Array<[number, number]> {
  return positions.map(([lat, lon]) => [lon, lat])
}

export type SegmentMapMapbox3DProps = {
  segmentPositions: Array<[number, number]>
  fullTrackPositions?: Array<[number, number]>
  height?: string
}

export default function SegmentMapMapbox3D({
  segmentPositions,
  fullTrackPositions,
  height = '100%',
}: SegmentMapMapbox3DProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<mapboxgl.Map | null>(null)

  useEffect(() => {
    const container = containerRef.current
    const token = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN
    if (!container || segmentPositions.length < 1 || !token) return

    const lonLatSegment = toLonLat(segmentPositions)
    const center = lonLatSegment[Math.floor(lonLatSegment.length / 2)]

    mapboxgl.accessToken = token
    const map = new mapboxgl.Map({
      container,
      style: 'mapbox://styles/mapbox/outdoors-v12',
      center: [center[0], center[1]],
      zoom: 12,
      pitch: 65,
      bearing: 0,
      maxPitch: 85,
    })

    map.addControl(new mapboxgl.NavigationControl({ visualizePitch: true }), 'top-right')

    map.on('style.load', () => {
      map.addSource('mapbox-dem', {
        type: 'raster-dem',
        url: 'mapbox://mapbox.mapbox-terrain-dem-v1',
        tileSize: 512,
        maxzoom: 14,
      })
      map.setTerrain({ source: 'mapbox-dem', exaggeration: 1.2 })

      if (fullTrackPositions && fullTrackPositions.length > 0) {
        const lonLatFull = toLonLat(fullTrackPositions)
        map.addSource('fullTrack', {
          type: 'geojson',
          data: {
            type: 'Feature',
            properties: {},
            geometry: { type: 'LineString', coordinates: lonLatFull },
          },
        })
        map.addLayer({
          id: 'fullTrack',
          type: 'line',
          source: 'fullTrack',
          layout: { 'line-join': 'round', 'line-cap': 'round' },
          paint: { 'line-color': '#6b7280', 'line-width': 3, 'line-opacity': 0.7 },
        })
      }

      map.addSource('segment', {
        type: 'geojson',
        data: {
          type: 'Feature',
          properties: {},
          geometry: { type: 'LineString', coordinates: lonLatSegment },
        },
      })
      map.addLayer({
        id: 'segment',
        type: 'line',
        source: 'segment',
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: { 'line-color': '#bfc900', 'line-width': 5 },
      })

      const bounds = new mapboxgl.LngLatBounds()
      lonLatSegment.forEach(([lon, lat]) => bounds.extend([lon, lat]))
      map.fitBounds(bounds, { padding: 48, maxZoom: 15, duration: 0 })
    })

    mapRef.current = map
    return () => {
      map.remove()
      mapRef.current = null
    }
  }, [segmentPositions, fullTrackPositions])

  const token = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN
  if (!token) {
    return (
      <div className="segment-map-mapbox3d segment-map-mapbox3d--no-token" style={{ height }}>
        <p>Vue 3D : ajoutez <code>VITE_MAPBOX_ACCESS_TOKEN</code> dans <code>.env</code> (clé sur <a href="https://account.mapbox.com" target="_blank" rel="noreferrer">account.mapbox.com</a>).</p>
      </div>
    )
  }

  if (segmentPositions.length < 1) {
    return (
      <div className="segment-map-mapbox3d segment-map-mapbox3d--empty" style={{ height }}>
        <p>Aucun point pour ce segment</p>
      </div>
    )
  }

  return (
    <div
      ref={containerRef}
      className="segment-map-mapbox3d"
      style={{ height }}
      aria-label="Carte 3D Mapbox avec relief et tracé sur le terrain"
    />
  )
}
