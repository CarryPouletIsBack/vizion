import { useEffect, useRef } from 'react'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import './MapboxCyberpunkContour.css'

const NEON_CYAN = '#00f7ff'
const NEON_CYAN_GLOW = 'rgba(0, 247, 255, 0.4)'

export type MapboxCyberpunkContourProps = {
  /** Centre initial [lon, lat] */
  center?: [number, number]
  /** Zoom initial (défaut 11) */
  initialZoom?: number
  /** Pitch en degrés (défaut 70, vue rasante) */
  pitch?: number
  /** Exagération du relief 3D (défaut 1.8) */
  terrainExaggeration?: number
  /** Hauteur du conteneur (défaut 100%) */
  height?: string
}

export default function MapboxCyberpunkContour({
  center = [55.45, -21.1],
  initialZoom = 11,
  pitch = 70,
  terrainExaggeration = 1.8,
  height = '100%',
}: MapboxCyberpunkContourProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<mapboxgl.Map | null>(null)

  useEffect(() => {
    const container = containerRef.current
    const token = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN
    if (!container || !token) return

    mapboxgl.accessToken = token
    const map = new mapboxgl.Map({
      container,
      style: 'mapbox://styles/mapbox/dark-v11',
      center,
      zoom: initialZoom,
      pitch,
      bearing: 0,
      minZoom: 8,
      maxZoom: 16,
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
      map.setTerrain({
        source: 'mapbox-dem',
        exaggeration: terrainExaggeration,
      })

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
        id: 'contour-glow',
        type: 'line',
        source: 'contours',
        'source-layer': 'contour',
        paint: {
          'line-color': NEON_CYAN_GLOW,
          'line-width': 4,
          'line-blur': 3,
          'line-opacity': 0.9,
        },
      })

      map.addLayer({
        id: 'contour-neon',
        type: 'line',
        source: 'contours',
        'source-layer': 'contour',
        paint: {
          'line-color': NEON_CYAN,
          'line-width': 1.2,
          'line-blur': 0.5,
          'line-opacity': 1,
        },
      })
    })

    mapRef.current = map
    return () => {
      map.remove()
      mapRef.current = null
    }
  }, [center[0], center[1], initialZoom, pitch, terrainExaggeration])

  const token = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN
  if (!token) {
    return (
      <div className="mapbox-cyberpunk mapbox-cyberpunk--no-token" style={{ height }}>
        <p>
          Carte cyberpunk : ajoutez <code>VITE_MAPBOX_ACCESS_TOKEN</code> dans <code>.env</code>.
        </p>
      </div>
    )
  }

  return (
    <div
      ref={containerRef}
      className="mapbox-cyberpunk"
      style={{ height }}
      aria-label="Carte 3D topographique style cyberpunk, courbes de niveau néon"
    />
  )
}
