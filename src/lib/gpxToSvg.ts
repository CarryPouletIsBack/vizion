/**
 * Conversion GPX → SVG côté client (fonctionne en production)
 */

type Point = [number, number] // [lat, lon]
type PointWithElevation = [number, number, number] // [lat, lon, ele]

/**
 * Parse un fichier GPX et extrait les points (lat, lon, ele)
 */
export function parseGpxPoints(gpxText: string): PointWithElevation[] {
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

  const width = 800
  const height = 600
  const margin = 20

  const scaleLat = (height - 2 * margin) / latRange
  const scaleLon = (width - 2 * margin) / lonRange
  const scale = Math.min(scaleLat, scaleLon)

  const normalized: Point[] = []
  for (const [lat, lon] of points) {
    const x = margin + (lon - minLon) * scale
    const y = height - margin - (lat - minLat) * scale
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
