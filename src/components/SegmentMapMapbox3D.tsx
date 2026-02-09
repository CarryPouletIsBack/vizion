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
      style: 'mapbox://styles/mapbox/dark-v11',
      center: [center[0], center[1]],
      zoom: 12,
      pitch: 65,
      bearing: 0,
      minZoom: 8,
      maxZoom: 15,
      maxPitch: 85,
    })

    map.addControl(new mapboxgl.NavigationControl({ visualizePitch: true }), 'top-right')

    map.on('style.load', () => {
      map.addSource('mapbox-dem', {
        type: 'raster-dem',
        url: 'mapbox://mapbox.mapbox-terrain-dem-v1',
        tileSize: 512,
        maxzoom: 12,
      })
      map.setTerrain({ source: 'mapbox-dem', exaggeration: 1.2 })

      if (typeof map.setFog === 'function') {
        map.setFog({
          color: '#0a0e14',
          'high-color': '#060a10',
          'space-color': '#020408',
          'horizon-blend': 0.2,
        })
      }

      map.addSource('contours', {
        type: 'vector',
        url: 'mapbox://mapbox.mapbox-terrain-v2',
      })
      map.addLayer({
        id: 'contour-lines',
        type: 'line',
        source: 'contours',
        'source-layer': 'contour',
        paint: {
          'line-color': '#5ee7f7',
          'line-width': 0.8,
          'line-opacity': 0.85,
        },
      })

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
          paint: { 'line-color': '#525252', 'line-width': 3, 'line-opacity': 0.8 },
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
        id: 'segment-outline',
        type: 'line',
        source: 'segment',
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: { 'line-color': '#1f2937', 'line-width': 7 },
      })
      map.addLayer({
        id: 'segment',
        type: 'line',
        source: 'segment',
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: { 'line-color': '#ffffff', 'line-width': 5 },
      })

      const bounds = new mapboxgl.LngLatBounds()
      lonLatSegment.forEach(([lon, lat]) => bounds.extend([lon, lat]))
      map.fitBounds(bounds, { padding: 48, maxZoom: 15, duration: 0 })
    })

    mapRef.current = map

    const ro = new ResizeObserver(() => {
      map.resize()
    })
    ro.observe(container)

    return () => {
      ro.disconnect()
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
