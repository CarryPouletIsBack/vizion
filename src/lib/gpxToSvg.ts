/**
 * Conversion GPX → SVG côté client (fonctionne en production)
 */

type Point = [number, number] // [lat, lon]
type PointWithElevation = [number, number, number] // [lat, lon, ele]

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

export type GpxStats = {
  distanceKm: number
  elevationGain: number
  profile: Array<[number, number]>
}

/**
 * Calcule distance, D+ et profil d'élévation à partir d'un GPX (trkpt/rtept uniquement).
 */
export function computeGpxStats(gpxText: string): GpxStats | null {
  if (!gpxText || typeof gpxText !== 'string') return null
  try {
    const parser = new DOMParser()
    const doc = parser.parseFromString(gpxText, 'application/xml')
    const points = Array.from(doc.querySelectorAll('trkpt, rtept'))
    const coords = points
      .map((pt) => {
        const lat = Number(pt.getAttribute('lat'))
        const lon = Number(pt.getAttribute('lon'))
        const eleNode = pt.querySelector('ele')
        const ele = eleNode ? Number(eleNode.textContent) : undefined
        if (Number.isNaN(lat) || Number.isNaN(lon)) return null
        return { lat, lon, ele }
      })
      .filter((pt): pt is { lat: number; lon: number; ele: number | undefined } => pt !== null)

    if (coords.length < 2) return null

    const toRad = (v: number) => (v * Math.PI) / 180
    const haversineKm = (
      a: { lat: number; lon: number },
      b: { lat: number; lon: number }
    ) => {
      const R = 6371
      const dLat = toRad(b.lat - a.lat)
      const dLon = toRad(b.lon - a.lon)
      const lat1 = toRad(a.lat)
      const lat2 = toRad(b.lat)
      const h =
        Math.sin(dLat / 2) ** 2 +
        Math.sin(dLon / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2)
      return 2 * R * Math.asin(Math.sqrt(h))
    }

    let distanceKm = 0
    let elevationGain = 0
    const profile: Array<[number, number]> = []

    for (let i = 1; i < coords.length; i += 1) {
      const prev = coords[i - 1]
      const curr = coords[i]
      distanceKm += haversineKm(prev, curr)
      if (prev.ele !== undefined && curr.ele !== undefined && curr.ele > prev.ele) {
        elevationGain += curr.ele - prev.ele
      }
      if (i % 10 === 0 && curr.ele !== undefined) {
        profile.push([Number(distanceKm.toFixed(2)), Math.round(curr.ele)])
      }
    }
    const last = coords[coords.length - 1]
    if (last?.ele !== undefined) {
      profile.push([Number(distanceKm.toFixed(2)), Math.round(last.ele)])
    }

    return { distanceKm, elevationGain, profile }
  } catch {
    return null
  }
}

export type GpxBounds = { minLat: number; maxLat: number; minLon: number; maxLon: number }

/**
 * Retourne les bornes géographiques du GPX (pour conversion lat/lon → SVG).
 */
export function getBoundsFromGpx(gpxText: string): GpxBounds | null {
  const points = parseGpxPoints(gpxText)
  if (points.length === 0) return null
  const lats = points.map((p) => p[0])
  const lons = points.map((p) => p[1])
  return {
    minLat: Math.min(...lats),
    maxLat: Math.max(...lats),
    minLon: Math.min(...lons),
    maxLon: Math.max(...lons),
  }
}

const HAVERSINE_R = 6371
function haversineKm(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const toRad = (v: number) => (v * Math.PI) / 180
  const dLat = toRad(b.lat - a.lat)
  const dLon = toRad(b.lon - a.lon)
  const lat1 = toRad(a.lat)
  const lat2 = toRad(b.lat)
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.sin(dLon / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2)
  return 2 * HAVERSINE_R * Math.asin(Math.sqrt(h))
}

/**
 * Échantillonne des points le long du tracé (par distance) pour interroger la météo.
 * Retourne au plus maxPoints [lat, lon], espacés approximativement de façon égale en distance.
 */
export function samplePointsAlongTrack(gpxText: string, maxPoints = 15): Array<[number, number]> {
  const points = parseGpxPoints(gpxText)
  if (points.length === 0) return []
  if (points.length === 1) return [[points[0][0], points[0][1]]]

  const withCumul: Array<{ lat: number; lon: number; cumulKm: number }> = []
  let cumul = 0
  withCumul.push({ lat: points[0][0], lon: points[0][1], cumulKm: 0 })
  for (let i = 1; i < points.length; i++) {
    cumul += haversineKm(
      { lat: points[i - 1][0], lon: points[i - 1][1] },
      { lat: points[i][0], lon: points[i][1] }
    )
    withCumul.push({ lat: points[i][0], lon: points[i][1], cumulKm: cumul })
  }

  const totalKm = withCumul[withCumul.length - 1]?.cumulKm ?? 0
  if (totalKm <= 0) return [[points[0][0], points[0][1]]]

  const out: Array<[number, number]> = []
  const n = Math.min(maxPoints, withCumul.length)
  for (let k = 0; k < n; k++) {
    const targetKm = totalKm * (k / (n - 1 || 1))
    const idx = withCumul.findIndex((p) => p.cumulKm >= targetKm)
    const p = idx <= 0 ? withCumul[0] : withCumul[Math.min(idx, withCumul.length - 1)]
    out.push([p.lat, p.lon])
  }
  return out
}

/** Constantes de normalisation SVG (identiques à normalizeCoordinates) */
const SVG_TARGET_WIDTH = 302
const SVG_TARGET_HEIGHT = 258
const SVG_MARGIN = 20

/**
 * Convertit (lat, lon) en coordonnées SVG (même repère que le path GPX).
 * À utiliser avec le viewBox du SVG produit par gpxToSvg.
 */
export function latLonToSvg(lat: number, lon: number, bounds: GpxBounds): [number, number] {
  const latRange = bounds.maxLat - bounds.minLat || 0.001
  const lonRange = bounds.maxLon - bounds.minLon || 0.001
  const scaleLat = (SVG_TARGET_HEIGHT - 2 * SVG_MARGIN) / latRange
  const scaleLon = (SVG_TARGET_WIDTH - 2 * SVG_MARGIN) / lonRange
  const aspectRatio = lonRange / latRange
  const targetAspectRatio = SVG_TARGET_WIDTH / SVG_TARGET_HEIGHT
  const scale =
    aspectRatio > targetAspectRatio ? scaleLon : scaleLat
  const x = SVG_MARGIN + (lon - bounds.minLon) * scale
  const y = SVG_TARGET_HEIGHT - SVG_MARGIN - (lat - bounds.minLat) * scale
  return [x, y]
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
