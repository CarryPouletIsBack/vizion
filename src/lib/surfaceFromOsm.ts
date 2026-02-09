/**
 * Calcul du type de sentier (surface) le long d'un tracé via OpenStreetMap (Overpass API).
 * Donne une répartition en % : goudron, gravier, sentier, etc.
 */

import { getBoundsFromGpx, parseGpxPoints, type GpxBounds, type GpxSurfaceBreakdown } from './gpxToSvg'

export type { GpxSurfaceBreakdown }

const OVERPASS_URL = 'https://overpass-api.de/api/interpreter'
const BBOX_PADDING = 0.008
const MAX_TRACK_SAMPLES = 300
const OVERPASS_TIMEOUT_SEC = 25

const CACHE_PREFIX = 'vizion_osm_'
const CACHE_KEYS_KEY = CACHE_PREFIX + 'keys'
const CACHE_MAX_ENTRIES = 6

export type OverpassWay = {
  type: 'way'
  id: number
  tags?: { surface?: string; highway?: string }
  geometry?: { lat: number; lon: number }[]
}

type OverpassResult = { elements?: OverpassWay[] }

const memoryCache = new Map<string, OverpassWay[]>()

/** Distance Haversine en km entre deux points (lat, lon). */
function haversineKm(
  a: [number, number],
  b: [number, number]
): number {
  const R = 6371
  const toRad = (v: number) => (v * Math.PI) / 180
  const dLat = toRad(b[0] - a[0])
  const dLon = toRad(b[1] - a[1])
  const lat1 = toRad(a[0])
  const lat2 = toRad(b[0])
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.sin(dLon / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2)
  return 2 * R * Math.asin(Math.sqrt(h))
}

/** Distance (km) d'un point P au segment AB (point le plus proche sur le segment). */
function distancePointToSegment(
  p: [number, number],
  a: [number, number],
  b: [number, number]
): number {
  const [plat, plon] = p
  const [alat, alon] = a
  const [blat, blon] = b
  const ax = (alon - plon) * Math.cos((plat * Math.PI) / 180)
  const ay = alat - plat
  const bx = (blon - plon) * Math.cos((plat * Math.PI) / 180)
  const by = blat - plat
  const t = Math.max(0, Math.min(1, (ax * bx + ay * by) / (bx * bx + by * by || 1e-9)))
  const qx = ax + t * (bx - ax)
  const qy = ay + t * (by - ay)
  const deg = Math.sqrt(qx * qx + qy * qy) * (180 / Math.PI)
  return (deg * 111.32)
}

/** Libellé français pour une valeur OSM surface/highway. */
function surfaceLabel(value: string): string {
  const v = value.toLowerCase()
  const map: Record<string, string> = {
    asphalt: 'Goudron',
    paved: 'Revêtu',
    concrete: 'Béton',
    'concrete:plates': 'Dalles',
    gravel: 'Gravier',
    fine_gravel: 'Gravier fin',
    dirt: 'Terre',
    ground: 'Terre',
    earth: 'Terre',
    grass: 'Herbe',
    sand: 'Sable',
    mud: 'Boue',
    wood: 'Bois',
    rock: 'Rocher',
    compacted: 'Compacté',
    unpaved: 'Non revêtu',
    path: 'Sentier',
    track: 'Piste',
    footway: 'Chemin piéton',
    cycleway: 'Piste cyclable',
  }
  return map[v] ?? value
}

function getCacheKey(south: number, west: number, north: number, east: number): string {
  return `${south.toFixed(5)},${west.toFixed(5)},${north.toFixed(5)},${east.toFixed(5)}`
}

function getFromSessionStorage(key: string): OverpassWay[] | null {
  try {
    const raw = sessionStorage.getItem(key)
    if (!raw) return null
    const parsed = JSON.parse(raw) as OverpassWay[]
    return Array.isArray(parsed) ? parsed : null
  } catch {
    return null
  }
}

function saveToSessionStorage(key: string, ways: OverpassWay[]): void {
  try {
    let keys: string[] = []
    const keysRaw = sessionStorage.getItem(CACHE_KEYS_KEY)
    if (keysRaw) {
      try {
        keys = JSON.parse(keysRaw)
        if (!Array.isArray(keys)) keys = []
      } catch {
        keys = []
      }
    }
    keys = keys.filter((k) => k !== key)
    keys.push(key)
    while (keys.length > CACHE_MAX_ENTRIES) {
      const oldest = keys.shift()
      if (oldest) sessionStorage.removeItem(oldest)
    }
    sessionStorage.setItem(CACHE_KEYS_KEY, JSON.stringify(keys))
    sessionStorage.setItem(key, JSON.stringify(ways))
  } catch {
    // quota or disabled
  }
}

/**
 * Récupère les ways OSM (surface / highway) dans la bbox (Overpass API).
 * Résultats mis en cache (mémoire + sessionStorage) pour éviter les appels répétés.
 */
export async function fetchWaysForBounds(bounds: GpxBounds): Promise<OverpassWay[]> {
  const south = Math.max(-90, bounds.minLat - BBOX_PADDING)
  const north = Math.min(90, bounds.maxLat + BBOX_PADDING)
  const west = bounds.minLon - BBOX_PADDING
  const east = bounds.maxLon + BBOX_PADDING
  const cacheKey = CACHE_PREFIX + getCacheKey(south, west, north, east)

  const fromMemory = memoryCache.get(cacheKey)
  if (fromMemory) return fromMemory

  const fromStorage = getFromSessionStorage(cacheKey)
  if (fromStorage) {
    memoryCache.set(cacheKey, fromStorage)
    return fromStorage
  }

  const query = `[out:json][timeout:${OVERPASS_TIMEOUT_SEC}];
( way["surface"](${south},${west},${north},${east});
  way["highway"~"path|track|footway|cycleway|steps"](${south},${west},${north},${east});
);
out body geom;`
  const res = await fetch(OVERPASS_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'data=' + encodeURIComponent(query),
  })
  if (!res.ok) return []
  const data = (await res.json()) as OverpassResult
  const ways = (data.elements ?? []).filter(
    (el): el is OverpassWay => el.type === 'way' && Array.isArray(el.geometry) && el.geometry.length >= 2
  )
  memoryCache.set(cacheKey, ways)
  saveToSessionStorage(cacheKey, ways)
  return ways
}

/**
 * Pour un point (lat, lon), trouve la surface du way le plus proche.
 */
function getSurfaceAtPoint(
  point: [number, number],
  ways: OverpassWay[]
): string {
  let best = ''
  let bestDist = Infinity
  for (const way of ways) {
    const geom = way.geometry!
    const surface = way.tags?.surface ?? way.tags?.highway ?? 'unknown'
    for (let i = 0; i < geom.length - 1; i++) {
      const a: [number, number] = [geom[i].lat, geom[i].lon]
      const b: [number, number] = [geom[i + 1].lat, geom[i + 1].lon]
      const d = distancePointToSegment(point, a, b)
      if (d < bestDist) {
        bestDist = d
        best = surface
      }
    }
  }
  return best || 'inconnu'
}

/**
 * Calcule la répartition des surfaces le long d'un tracé (points [lat, lon]) via OSM.
 * Utilisable avec des points dérivés du GPX ou du SVG (bounds + path).
 * Retourne null en cas d'erreur ou si pas de ways avec surface dans la zone.
 */
export async function fetchSurfaceBreakdown(
  points: Array<[number, number]>,
  bounds: GpxBounds
): Promise<GpxSurfaceBreakdown | null> {
  if (points.length < 2) return null

  const ways = await fetchWaysForBounds(bounds)
  if (ways.length === 0) return null
  return computeSurfaceBreakdownFromWays(points, ways)
}

/**
 * Calcule la répartition des surfaces à partir de points et de ways OSM déjà récupérés.
 * Permet de calculer par segment sans refaire d’appel Overpass.
 */
export function computeSurfaceBreakdownFromWays(
  points: Array<[number, number]>,
  ways: OverpassWay[]
): GpxSurfaceBreakdown | null {
  if (points.length < 2 || ways.length === 0) return null

  const coords = points
  const surfaceDist: Record<string, number> = {}
  const step = Math.max(1, Math.floor((coords.length - 1) / Math.min(MAX_TRACK_SAMPLES, coords.length - 1)))

  for (let i = 0; i < coords.length - 1; i += step) {
    const a = coords[i]
    const b = coords[Math.min(i + 1, coords.length - 1)]
    const segKm = haversineKm(a, b)
    const midLat = (a[0] + b[0]) / 2
    const midLon = (a[1] + b[1]) / 2
    const surface = getSurfaceAtPoint([midLat, midLon], ways)
    const key = surfaceLabel(surface)
    surfaceDist[key] = (surfaceDist[key] ?? 0) + segKm
  }
  if (step > 1 && coords.length >= 2) {
    const a = coords[coords.length - 2]
    const b = coords[coords.length - 1]
    const segKm = haversineKm(a, b)
    const midLat = (a[0] + b[0]) / 2
    const midLon = (a[1] + b[1]) / 2
    const surface = getSurfaceAtPoint([midLat, midLon], ways)
    const key = surfaceLabel(surface)
    surfaceDist[key] = (surfaceDist[key] ?? 0) + segKm
  }

  const totalSampled = Object.values(surfaceDist).reduce((a, b) => a + b, 0)
  if (totalSampled <= 0) return null

  const breakdown: GpxSurfaceBreakdown = Object.entries(surfaceDist).map(([surface, km]) => ({
    surface,
    percent: Math.round((km / totalSampled) * 1000) / 10,
  }))
  breakdown.sort((a, b) => b.percent - a.percent)
  return breakdown
}

/**
 * Calcule la répartition des surfaces à partir du GPX brut (texte XML).
 */
export async function fetchGpxSurfaceBreakdown(gpxText: string): Promise<GpxSurfaceBreakdown | null> {
  const points = parseGpxPoints(gpxText)
  if (points.length < 2) return null
  const bounds = getBoundsFromGpx(gpxText)
  if (!bounds) return null
  const coords = points.map((p) => [p[0], p[1]] as [number, number])
  return fetchSurfaceBreakdown(coords, bounds)
}
