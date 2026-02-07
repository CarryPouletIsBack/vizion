/**
 * Client météo Xweather avec cache 4h.
 * Une requête par position (arrondie) au plus toutes les 4 heures.
 */

const CACHE_KEY_PREFIX = 'trackali:weather:'
const TTL_MS = 4 * 60 * 60 * 1000 // 4 heures
const COORD_PRECISION = 2 // décimales pour regrouper les positions proches

export type WeatherResult = {
  tempC: number
  icon?: string
  /** true = pluie dans les dernières 24h, false = sec, undefined = inconnu */
  rainLast24h?: boolean
  /** Vitesse du vent en km/h */
  windSpeedKmh?: number
  /** Direction du vent en degrés (0 = N, 90 = E, 180 = S, 270 = O) */
  windDirDeg?: number
  /** Direction du vent en cardinal (N, NNE, NE, etc.) */
  windDir?: string
  fromCache: boolean
  fetchedAt: number
}

function cacheKey(lat: number, lon: number): string {
  const latR = Math.round(lat * 10 ** COORD_PRECISION) / 10 ** COORD_PRECISION
  const lonR = Math.round(lon * 10 ** COORD_PRECISION) / 10 ** COORD_PRECISION
  return `${CACHE_KEY_PREFIX}${latR}:${lonR}`
}

function getCached(lat: number, lon: number): WeatherResult | null {
  try {
    const key = cacheKey(lat, lon)
    const raw = localStorage.getItem(key)
    if (!raw) return null
    const parsed = JSON.parse(raw) as {
      tempC: number
      fetchedAt: number
      icon?: string
      rainLast24h?: boolean
      windSpeedKmh?: number
      windDirDeg?: number
      windDir?: string
    }
    if (typeof parsed.tempC !== 'number' || typeof parsed.fetchedAt !== 'number') return null
    if (Date.now() - parsed.fetchedAt > TTL_MS) return null
    return {
      tempC: parsed.tempC,
      icon: parsed.icon,
      rainLast24h: parsed.rainLast24h,
      windSpeedKmh: parsed.windSpeedKmh,
      windDirDeg: parsed.windDirDeg,
      windDir: parsed.windDir,
      fromCache: true,
      fetchedAt: parsed.fetchedAt,
    }
  } catch {
    return null
  }
}

function setCache(
  lat: number,
  lon: number,
  tempC: number,
  icon?: string,
  rainLast24h?: boolean,
  windSpeedKmh?: number,
  windDirDeg?: number,
  windDir?: string
): void {
  try {
    const key = cacheKey(lat, lon)
    const value = {
      tempC,
      fetchedAt: Date.now(),
      icon,
      rainLast24h,
      windSpeedKmh,
      windDirDeg,
      windDir,
    }
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // quota ou localStorage désactivé
  }
}

/**
 * Récupère la température pour une position (lat, lon).
 * Utilise le cache si valide (< 4h), sinon appelle l’API puis met en cache.
 * Retourne null en cas d’erreur ou si l’API n’est pas configurée.
 */
export async function getWeather(lat: number, lon: number): Promise<WeatherResult | null> {
  const cached = getCached(lat, lon)
  if (cached) return cached

  const base = typeof window !== 'undefined' ? window.location.origin : ''
  const url = `${base}/api/weather?lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lon)}`

  try {
    const res = await fetch(url)
    if (!res.ok) return null // 401, 500, 502, etc. → pas de météo (ex. XWeather non configuré ou protection Vercel)
    const data = (await res.json()) as {
      tempC?: number
      icon?: string
      rainLast24h?: boolean
      windSpeedKmh?: number
      windDirDeg?: number
      windDir?: string
    }
    const tempC = typeof data?.tempC === 'number' ? data.tempC : null
    if (tempC == null) return null
    const icon = typeof data?.icon === 'string' ? data.icon : undefined
    const rainLast24h = typeof data?.rainLast24h === 'boolean' ? data.rainLast24h : undefined
    const windSpeedKmh = typeof data?.windSpeedKmh === 'number' ? data.windSpeedKmh : undefined
    const windDirDeg = typeof data?.windDirDeg === 'number' && data.windDirDeg >= 0 && data.windDirDeg <= 360 ? data.windDirDeg : undefined
    const windDir = typeof data?.windDir === 'string' && data.windDir ? data.windDir : undefined
    setCache(lat, lon, tempC, icon, rainLast24h, windSpeedKmh, windDirDeg, windDir)
    return {
      tempC,
      icon,
      rainLast24h,
      windSpeedKmh,
      windDirDeg,
      windDir,
      fromCache: false,
      fetchedAt: Date.now(),
    }
  } catch {
    return null
  }
}

/** Icônes météo affichables : soleil, nuage, pluie, lune */
export type WeatherIconType = 'sun' | 'cloud' | 'rain' | 'moon'

/**
 * Map le code/icône API (Aeris) ou l'heure vers une des 4 icônes.
 * La nuit (20h–6h) on affiche la lune si le temps est dégagé.
 */
export function weatherIconType(apiIcon?: string | null, date: Date = new Date()): WeatherIconType {
  const hour = date.getHours()
  const isNight = hour < 6 || hour >= 20
  const icon = (apiIcon ?? '').toLowerCase()

  if (icon.includes('rain') || icon.includes('drizzle') || icon.includes('snow') || icon.includes('storm')) return 'rain'
  if (icon.includes('cloud') || icon.includes('fog') || icon.includes('overcast')) return 'cloud'
  if (icon.includes('clear') || icon.includes('fair') || icon.includes('sun')) return isNight ? 'moon' : 'sun'
  return isNight ? 'moon' : 'sun'
}

const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/reverse'
const NOMINATIM_TTL_MS = 4 * 60 * 60 * 1000 // 4h
const CITY_CACHE_KEY = 'trackali:weather:city'

/**
 * Récupère le nom de la ville (ou lieu) pour des coordonnées (reverse geocoding).
 * Utilise Nominatim avec cache 4h par position.
 */
export async function getCityFromCoords(lat: number, lon: number): Promise<string | null> {
  const cacheKey = `${CITY_CACHE_KEY}:${Math.round(lat * 100)}:${Math.round(lon * 100)}`
  try {
    const raw = localStorage.getItem(cacheKey)
    if (raw) {
      const { city, fetchedAt } = JSON.parse(raw) as { city: string; fetchedAt: number }
      if (Date.now() - fetchedAt < NOMINATIM_TTL_MS) return city
    }
  } catch {
    // ignore
  }

  try {
    const url = `${NOMINATIM_URL}?lat=${lat}&lon=${lon}&format=json&addressdetails=1`
    const res = await fetch(url, {
      headers: { Accept: 'application/json', 'User-Agent': 'TrackaliApp/1.0 (trail prep app)' },
    })
    if (!res.ok) return null
    const data = (await res.json()) as { address?: { city?: string; town?: string; village?: string; municipality?: string } }
    const addr = data?.address ?? {}
    const city = addr.city ?? addr.town ?? addr.village ?? addr.municipality ?? null
    if (city) localStorage.setItem(cacheKey, JSON.stringify({ city, fetchedAt: Date.now() }))
    return city
  } catch {
    return null
  }
}
