/**
 * Conversion GPX → SVG côté client (fonctionne en production)
 */

type Point = [number, number] // [lat, lon]
type PointWithElevation = [number, number, number] // [lat, lon, ele]

const SVG_TARGET_WIDTH_BOUNDS = 302
const SVG_TARGET_HEIGHT_BOUNDS = 258
const SVG_MARGIN_BOUNDS = 20
const SVG_DRAW_WIDTH = SVG_TARGET_WIDTH_BOUNDS - 2 * SVG_MARGIN_BOUNDS
const SVG_DRAW_HEIGHT = SVG_TARGET_HEIGHT_BOUNDS - 2 * SVG_MARGIN_BOUNDS

function parsePathBbox(pathData: string): { minX: number; maxX: number; minY: number; maxY: number } | null {
  const commands = pathData.match(/[ML]\s*([\d.-]+),([\d.-]+)/g) || []
  if (commands.length === 0) return null
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity
  for (const cmd of commands) {
    const m = cmd.match(/([\d.-]+),([\d.-]+)/)
    if (!m) continue
    const x = parseFloat(m[1])
    const y = parseFloat(m[2])
    if (Number.isNaN(x) || Number.isNaN(y)) continue
    if (x < minX) minX = x
    if (x > maxX) maxX = x
    if (y < minY) minY = y
    if (y > maxY) maxY = y
  }
  if (minX === Infinity || minY === Infinity) return null
  return { minX, maxX, minY, maxY }
}

/**
 * Retourne la bbox du tracé COMPLET (path avec la plus grande étendue).
 * Dans un SVG segmenté, les premiers paths sont des zones/segments partiels ; on évite de les utiliser
 * pour que les bounds restent cohérentes avec getSegmentPathPoints (tracé complet).
 */
function getPathBboxFromSvg(svgContent: string): { minX: number; maxX: number; minY: number; maxY: number } | null {
  const pathRegex = /<path[^>]*\sd=["']([^"']+)["']/g
  let best: { minX: number; maxX: number; minY: number; maxY: number } | null = null
  let bestArea = -1
  let match: RegExpExecArray | null
  while ((match = pathRegex.exec(svgContent)) !== null) {
    const bbox = parsePathBbox(match[1])
    if (!bbox) continue
    const w = bbox.maxX - bbox.minX
    const h = bbox.maxY - bbox.minY
    const area = w * h
    if (area > bestArea) {
      bestArea = area
      best = bbox
    }
  }
  return best
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

/**
 * Estime les bornes géographiques à partir d’un SVG produit par gpxToSvg,
 * quand on n’a pas le GPX (ex. course chargée depuis Supabase sans gpxBounds).
 * Utilise le path du SVG pour déduire scale et ranges (cohérent avec svgPointToLatLon).
 */
/**
 * Normalise un point [a, b] en [lat, lon]. Si a ∉ [-90,90] et b ∈ [-90,90], on suppose [lon, lat] et on swap.
 */
function normalizeCenterToLatLon(center: [number, number] | undefined | null): [number, number] {
  if (!center || center.length < 2) return [0, 0]
  const a = center[0]
  const b = center[1]
  if (Math.abs(a) <= 90 && Math.abs(b) <= 180) return [a, b]
  if (Math.abs(a) <= 180 && Math.abs(b) <= 90) return [b, a]
  return [a, b]
}

const GPX_BOUNDS_COMMENT_REGEX = /<!--\s*gpx-bounds:([\d.-]+),([\d.-]+),([\d.-]+),([\d.-]+)\s*-->/

export function getBoundsFromSvg(
  svgContent: string,
  center?: [number, number] | null,
  totalKm?: number
): GpxBounds | null {
  if (!svgContent || typeof svgContent !== 'string') return null

  const embedded = svgContent.match(GPX_BOUNDS_COMMENT_REGEX)
  if (embedded) {
    const minLat = parseFloat(embedded[1])
    const maxLat = parseFloat(embedded[2])
    const minLon = parseFloat(embedded[3])
    const maxLon = parseFloat(embedded[4])
    if (!Number.isNaN(minLat) && !Number.isNaN(maxLat) && !Number.isNaN(minLon) && !Number.isNaN(maxLon)) {
      return { minLat, maxLat, minLon, maxLon }
    }
  }

  const [lat0, lon0] = normalizeCenterToLatLon(center)

  const pathBbox = getPathBboxFromSvg(svgContent)
  if (pathBbox && totalKm != null && totalKm > 0) {
    const pathWidth = pathBbox.maxX - pathBbox.minX
    const pathHeight = pathBbox.maxY - pathBbox.minY
    if (pathWidth > 0 && pathHeight > 0) {
      const widthLimiting = pathWidth / pathHeight >= SVG_DRAW_WIDTH / SVG_DRAW_HEIGHT
      const pathCenterX = (pathBbox.minX + pathBbox.maxX) / 2
      const pathCenterY = (pathBbox.minY + pathBbox.maxY) / 2
      // Facteur > 1 pour resserrer les bounds (éviter que le tracé soit trop étiré / dépasse la côte)
      const extentFactor = 1.45
      let scale: number
      let lonRange: number
      let latRange: number
      if (widthLimiting) {
        scale = ((SVG_DRAW_WIDTH + pathHeight) * 111) / (totalKm * extentFactor)
        scale = Math.max(0.1, Math.min(10000, scale))
        lonRange = SVG_DRAW_WIDTH / scale
        latRange = pathHeight / scale
      } else {
        scale = ((pathWidth + SVG_DRAW_HEIGHT) * 111) / (totalKm * extentFactor)
        scale = Math.max(0.1, Math.min(10000, scale))
        latRange = SVG_DRAW_HEIGHT / scale
        lonRange = pathWidth / scale
      }
      // Positionner les bounds pour que le point (pathCenterX, pathCenterY) corresponde au centre géographique
      // (évite le décalage quand le départ n'est pas au centre du tracé)
      const lonCenter = lon0 - lonRange * (0.5 - (pathCenterX - SVG_MARGIN_BOUNDS) / (widthLimiting ? SVG_DRAW_WIDTH : pathWidth))
      const latCenter = lat0 - latRange * (0.5 - (SVG_TARGET_HEIGHT_BOUNDS - SVG_MARGIN_BOUNDS - pathCenterY) / (widthLimiting ? pathHeight : SVG_DRAW_HEIGHT))
      return {
        minLat: latCenter - latRange / 2,
        maxLat: latCenter + latRange / 2,
        minLon: lonCenter - lonRange / 2,
        maxLon: lonCenter + lonRange / 2,
      }
    }
  }

  const match = svgContent.match(/viewBox=["']([^"']+)["']/)
  if (!match) return null
  const parts = match[1].trim().split(/\s+/).map(Number)
  if (parts.length !== 4 || parts.some(Number.isNaN)) return null
  const [, , vbW, vbH] = parts
  if (vbW <= 0 || vbH <= 0) return null
  const ratio = vbW / vbH
  let latRange: number
  if (totalKm != null && totalKm > 0) {
    const spanDeg = (totalKm / 111) * 0.45
    latRange = Math.max(0.005, Math.min(0.5, spanDeg))
  } else {
    latRange = 0.04
  }
  const lonRange = latRange * ratio
  return {
    minLat: lat0 - latRange / 2,
    maxLat: lat0 + latRange / 2,
    minLon: lon0 - lonRange / 2,
    maxLon: lon0 + lonRange / 2,
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
 * Convertit un point SVG (x, y) en coordonnées géographiques (lat, lon).
 * Utilise le même repère que latLonToSvg / gpxToSvg (viewBox 302×258).
 */
export function svgPointToLatLon(x: number, y: number, bounds: GpxBounds): [number, number] {
  const latRange = bounds.maxLat - bounds.minLat || 0.001
  const lonRange = bounds.maxLon - bounds.minLon || 0.001
  const scaleLat = (SVG_TARGET_HEIGHT - 2 * SVG_MARGIN) / latRange
  const scaleLon = (SVG_TARGET_WIDTH - 2 * SVG_MARGIN) / lonRange
  const aspectRatio = lonRange / latRange
  const targetAspectRatio = SVG_TARGET_WIDTH / SVG_TARGET_HEIGHT
  const scale = aspectRatio > targetAspectRatio ? scaleLon : scaleLat
  const lon = (x - SVG_MARGIN) / scale + bounds.minLon
  const lat = (SVG_TARGET_HEIGHT - SVG_MARGIN - y) / scale + bounds.minLat
  return [lat, lon]
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
 * Convertit un GPX en SVG (côté client).
 * Injecte les bounds exactes en commentaire pour que getBoundsFromSvg les relise à l'affichage (alignement carte garanti).
 */
export function gpxToSvg(gpxText: string): string {
  const points = parseGpxPoints(gpxText)
  if (points.length === 0) {
    return '<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><text x="50" y="50" text-anchor="middle" fill="#888">Aucun tracé GPX</text></svg>'
  }

  const lats = points.map((p) => p[0])
  const lons = points.map((p) => p[1])
  const minLat = Math.min(...lats)
  const maxLat = Math.max(...lats)
  const minLon = Math.min(...lons)
  const maxLon = Math.max(...lons)

  const { normalized, viewBox } = normalizeCoordinates(points)
  const pathData = 'M ' + normalized.map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`).join(' L ')

  const boundsComment = `<!-- gpx-bounds:${minLat},${maxLat},${minLon},${maxLon} -->\n`
  const svg = `<svg viewBox="${viewBox.x} ${viewBox.y} ${viewBox.width} ${viewBox.height}" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid meet">
  <path d="${pathData}" fill="none" stroke="#b2aaaa" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" opacity="0.9"/>
</svg>`
  return boundsComment + svg
}
