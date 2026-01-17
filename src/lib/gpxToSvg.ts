/**
 * Conversion GPX → SVG côté client (fonctionne en production)
 */

type Point = [number, number] // [lat, lon]
type PointWithElevation = [number, number, number] // [lat, lon, ele]

export type GpxMetadata = {
  name?: string
  description?: string
  author?: string
  copyright?: string
  link?: string
  keywords?: string
  bounds?: {
    minLat: number
    maxLat: number
    minLon: number
    maxLon: number
  }
}

export type GpxWaypoint = {
  lat: number
  lon: number
  ele?: number
  name?: string
  description?: string
  extensions?: Record<string, any>
}

/**
 * Parse un fichier GPX et extrait les points (lat, lon, ele)
 */
export function parseGpxPoints(gpxText: string): PointWithElevation[] {
  if (!gpxText || typeof gpxText !== 'string') return []
  const parser = new DOMParser()
  const doc = parser.parseFromString(gpxText, 'application/xml')
  const points: PointWithElevation[] = []

  // Chercher les track points
  const trkpts = doc.querySelectorAll('trkpt, rtept, wpt')
  trkpts.forEach((pt) => {
    const lat = Number(pt.getAttribute('lat'))
    const lon = Number(pt.getAttribute('lon'))
    const eleNode = pt.querySelector('ele')
    const ele = eleNode ? Number(eleNode.textContent) : 0

    if (!Number.isNaN(lat) && !Number.isNaN(lon)) {
      points.push([lat, lon, ele])
    }
  })

  return points
}

/**
 * Extrait les métadonnées d'un fichier GPX
 */
export function extractGpxMetadata(gpxText: string): GpxMetadata {
  if (!gpxText || typeof gpxText !== 'string') return {}
  try {
    const parser = new DOMParser()
    const doc = parser.parseFromString(gpxText, 'application/xml')
    const metadata: GpxMetadata = {}

    const metadataEl = doc.querySelector('metadata')
    if (metadataEl) {
      const nameEl = metadataEl.querySelector('name')
      if (nameEl) metadata.name = nameEl.textContent || undefined

      const descEl = metadataEl.querySelector('desc')
      if (descEl) metadata.description = descEl.textContent || undefined

      const authorEl = metadataEl.querySelector('author')
      if (authorEl) metadata.author = authorEl.textContent || undefined

      const copyrightEl = metadataEl.querySelector('copyright')
      if (copyrightEl) metadata.copyright = copyrightEl.getAttribute('author') || undefined

      const linkEl = metadataEl.querySelector('link')
      if (linkEl) metadata.link = linkEl.getAttribute('href') || undefined

      const keywordsEl = metadataEl.querySelector('keywords')
      if (keywordsEl) metadata.keywords = keywordsEl.textContent || undefined

      const boundsEl = metadataEl.querySelector('bounds')
      if (boundsEl) {
        metadata.bounds = {
          minLat: Number(boundsEl.getAttribute('minlat')) || 0,
          maxLat: Number(boundsEl.getAttribute('maxlat')) || 0,
          minLon: Number(boundsEl.getAttribute('minlon')) || 0,
          maxLon: Number(boundsEl.getAttribute('maxlon')) || 0,
        }
      }
    }

    // Aussi chercher dans la racine <gpx>
    const gpxEl = doc.querySelector('gpx')
    if (gpxEl) {
      const nameEl = gpxEl.querySelector('> name')
      if (nameEl && !metadata.name) metadata.name = nameEl.textContent || undefined

      const descEl = gpxEl.querySelector('> desc')
      if (descEl && !metadata.description) metadata.description = descEl.textContent || undefined
    }

    return metadata
  } catch (error) {
    console.warn('Erreur lors de l\'extraction des métadonnées GPX:', error)
    return {}
  }
}

/**
 * Extrait les waypoints d'un fichier GPX
 */
export function extractGpxWaypoints(gpxText: string): GpxWaypoint[] {
  if (!gpxText || typeof gpxText !== 'string') return []
  try {
    const parser = new DOMParser()
    const doc = parser.parseFromString(gpxText, 'application/xml')
    const waypoints: GpxWaypoint[] = []

    const wptElements = doc.querySelectorAll('wpt')
    wptElements.forEach((wpt) => {
      const lat = Number(wpt.getAttribute('lat'))
      const lon = Number(wpt.getAttribute('lon'))
      if (Number.isNaN(lat) || Number.isNaN(lon)) return

      const waypoint: GpxWaypoint = { lat, lon }

      const eleEl = wpt.querySelector('ele')
      if (eleEl) waypoint.ele = Number(eleEl.textContent) || undefined

      const nameEl = wpt.querySelector('name')
      if (nameEl) waypoint.name = nameEl.textContent || undefined

      const descEl = wpt.querySelector('desc')
      if (descEl) waypoint.description = descEl.textContent || undefined

      // Extraire les extensions si présentes
      const extensionsEl = wpt.querySelector('extensions')
      if (extensionsEl) {
        const extensions: Record<string, any> = {}
        Array.from(extensionsEl.children).forEach((child) => {
          const tagName = child.tagName.toLowerCase()
          const text = child.textContent
          if (text) {
            // Essayer de parser comme nombre si possible
            const num = Number(text)
            extensions[tagName] = Number.isNaN(num) ? text : num
          }
        })
        if (Object.keys(extensions).length > 0) {
          waypoint.extensions = extensions
        }
      }

      waypoints.push(waypoint)
    })

    return waypoints
  } catch (error) {
    console.warn('Erreur lors de l\'extraction des waypoints GPX:', error)
    return []
  }
}

/**
 * Extrait les coordonnées de départ (premier point) d'un fichier GPX
 */
export function extractGpxStartCoordinates(gpxText: string): [number, number] | null {
  if (!gpxText || typeof gpxText !== 'string') return null
  const points = parseGpxPoints(gpxText)
  if (points.length === 0) return null
  // Retourner [lat, lon] du premier point
  return [points[0][0], points[0][1]]
}

/**
 * Normalise les coordonnées GPS en coordonnées SVG
 */
function normalizeCoordinates(points: PointWithElevation[]): {
  normalized: Point[]
  viewBox: { x: number; y: number; width: number; height: number }
} {
  if (points.length === 0) {
    return {
      normalized: [],
      viewBox: { x: 0, y: 0, width: 100, height: 100 },
    }
  }

  const lats = points.map((p) => p[0])
  const lons = points.map((p) => p[1])

  const minLat = Math.min(...lats)
  const maxLat = Math.max(...lats)
  const minLon = Math.min(...lons)
  const maxLon = Math.max(...lons)

  const latRange = maxLat - minLat || 0.001
  const lonRange = maxLon - minLon || 0.001

  // Dimensions cibles pour le conteneur (302px x 258px ≈ 1.17:1)
  const targetWidth = 302
  const targetHeight = 258
  const margin = 20

  // Calculer les facteurs d'échelle pour chaque dimension
  const scaleLat = (targetHeight - 2 * margin) / latRange
  const scaleLon = (targetWidth - 2 * margin) / lonRange
  
  // Utiliser le facteur d'échelle le plus petit pour maintenir les proportions
  // mais limiter l'aspect ratio pour éviter les SVG trop verticaux
  const aspectRatio = lonRange / latRange
  const targetAspectRatio = targetWidth / targetHeight
  
  let scale: number
  if (aspectRatio > targetAspectRatio) {
    // Le tracé est plus large que le conteneur → limiter par la largeur
    scale = scaleLon
  } else {
    // Le tracé est plus haut que le conteneur → limiter par la hauteur
    scale = scaleLat
  }

  const normalized: Point[] = []
  for (const [lat, lon] of points) {
    const x = margin + (lon - minLon) * scale
    const y = targetHeight - margin - (lat - minLat) * scale
    normalized.push([x, y])
  }

  const minX = Math.min(...normalized.map((p) => p[0]))
  const maxX = Math.max(...normalized.map((p) => p[0]))
  const minY = Math.min(...normalized.map((p) => p[1]))
  const maxY = Math.max(...normalized.map((p) => p[1]))

  const padding = 5
  return {
    normalized,
    viewBox: {
      x: minX - padding,
      y: minY - padding,
      width: maxX - minX + 2 * padding,
      height: maxY - minY + 2 * padding,
    },
  }
}

/**
 * Convertit un GPX en SVG (côté client)
 */
export function gpxToSvg(gpxText: string): string {
  const points = parseGpxPoints(gpxText)
  if (points.length === 0) {
    return '<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><text x="50" y="50" text-anchor="middle" fill="#888">Aucun tracé GPX</text></svg>'
  }

  const { normalized, viewBox } = normalizeCoordinates(points)
  const pathData = 'M ' + normalized.map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`).join(' L ')

  return `<svg viewBox="${viewBox.x} ${viewBox.y} ${viewBox.width} ${viewBox.height}" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid meet">
  <path d="${pathData}" fill="none" stroke="#b2aaaa" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" opacity="0.9"/>
</svg>`
}
