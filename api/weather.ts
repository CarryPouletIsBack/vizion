import type { VercelRequest, VercelResponse } from '@vercel/node'
import { fetchWeatherApi } from 'openmeteo'

const CACHE_TTL_SECONDS = 4 * 60 * 60 // 4 heures
const OPEN_METEO_URL = 'https://api.open-meteo.com/v1/forecast'

/** Direction cardinale du vent à partir des degrés (0 = N, 90 = E) — mêmes clés que SingleCoursePage WIND_DIR_DEG */
const WIND_DIR_CARDINALS = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW']
function windDegToCardinal(deg: number): string {
  const idx = Math.round(((deg % 360) / 360) * WIND_DIR_CARDINALS.length) % WIND_DIR_CARDINALS.length
  return WIND_DIR_CARDINALS[idx] ?? 'N'
}

/**
 * Convertit le code WMO (Open-Meteo) en chaîne icône pour compatibilité affichage.
 * Voir https://open-meteo.com/en/docs#weather_variable_documentation
 */
function weatherCodeToIcon(code: number): string {
  if (code === 0) return 'clear'
  if (code >= 1 && code <= 3) return 'cloud'
  if (code === 45 || code === 48) return 'fog'
  if (
    (code >= 51 && code <= 67) ||
    (code >= 71 && code <= 77) ||
    (code >= 80 && code <= 82) ||
    (code >= 85 && code <= 86) ||
    (code >= 95 && code <= 99)
  ) {
    return 'rain'
  }
  return 'clear'
}

/** Génère un tableau [start, start+step, start+2*step, ...] jusqu'à stop (exclu) */
function range(start: number, stop: number, step: number): number[] {
  return Array.from({ length: (stop - start) / step }, (_, i) => start + i * step)
}

/** Lit une variable daily type time (sunrise/sunset) → tableau de Date */
function getDailyDate(variable: { valuesInt64Length: () => number; valuesInt64: (i: number) => bigint }, offsetSeconds: number): Date[] {
  return [...Array(variable.valuesInt64Length())].map((_, i) =>
    new Date((Number(variable.valuesInt64(i)) + offsetSeconds) * 1000)
  )
}

/**
 * Route API météo (Open-Meteo, modèle Météo-France).
 * Retourne : champs compatibles existants (tempC, icon, rainLast24h, wind…) + current/hourly/daily pour la simulation.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method Not Allowed' })
  }

  const lat = req.query.lat as string
  const lon = req.query.lon as string
  const latNum = lat != null ? parseFloat(lat) : NaN
  const lonNum = lon != null ? parseFloat(lon) : NaN

  if (Number.isNaN(latNum) || Number.isNaN(lonNum) || latNum < -90 || latNum > 90 || lonNum < -180 || lonNum > 180) {
    return res.status(400).json({ error: 'Paramètres lat et lon requis et valides (lat -90..90, lon -180..180)' })
  }

  try {
    const params = {
      latitude: [latNum],
      longitude: [lonNum],
      timezone: 'auto' as const,
      models: 'meteofrance_seamless' as const,
      past_days: 1,

      // 1. Météo instantanée (affichage "En ce moment" + compat existante)
      current: [
        'temperature_2m',
        'apparent_temperature',
        'is_day',
        'precipitation',
        'wind_speed_10m',
        'wind_gusts_10m',
        'wind_direction_10m',
        'weather_code',
      ],

      // 2. Prévisions heure par heure (simulation : ressenti, pluie, neige, vent, boue, niveau gel)
      hourly: [
        'temperature_2m',
        'apparent_temperature',
        'precipitation',
        'snowfall',
        'rain',
        'wind_speed_10m',
        'wind_gusts_10m',
        'soil_moisture_0_to_1cm',
        'freezing_level_height',
      ],

      // 3. Infos journalières (stratégie jour/nuit + pluie 24h)
      daily: ['sunrise', 'sunset', 'daylight_duration', 'precipitation_sum'],
    }

    const responses = await fetchWeatherApi(OPEN_METEO_URL, params)
    const response = responses?.[0]
    if (!response) {
      return res.status(502).json({
        error: 'Données météo indisponibles',
        message: 'Aucune réponse pour cette position.',
      })
    }

    const utcOffsetSeconds = response.utcOffsetSeconds()
    const current = response.current()
    const hourly = response.hourly()
    const daily = response.daily()
    if (!current || !hourly || !daily) {
      return res.status(502).json({
        error: 'Données météo incomplètes',
        message: 'Réponse Open-Meteo invalide.',
      })
    }

    // Ordre current : temperature_2m(0), apparent_temperature(1), is_day(2), precipitation(3), wind_speed_10m(4), wind_gusts_10m(5), wind_direction_10m(6), weather_code(7)
    const tempC = current.variables(0)?.value()
    const weatherCode = current.variables(7)?.value()
    const windSpeed10m = current.variables(4)?.value()
    const windDir10m = current.variables(6)?.value()
    if (tempC == null || typeof tempC !== 'number') {
      return res.status(502).json({
        error: 'Données météo incomplètes',
        message: 'Température non disponible pour ce point.',
      })
    }

    const icon = weatherCode != null ? weatherCodeToIcon(Number(weatherCode)) : undefined

    // Pluie dernières 24h : daily precipitation_sum (indices 0,1,2 = sunrise, sunset, daylight_duration, 3 = precipitation_sum)
    let rainLast24h: boolean | undefined
    const precipSumVar = daily.variables(3)
    if (precipSumVar) {
      const values = precipSumVar.valuesArray()
      if (values && values.length > 0) {
        rainLast24h = values.some((v: number) => v > 0)
      }
    }

    const windSpeedKmh = typeof windSpeed10m === 'number' && windSpeed10m >= 0 ? windSpeed10m : undefined
    const windDirDeg = typeof windDir10m === 'number' && windDir10m >= 0 && windDir10m <= 360 ? windDir10m : undefined
    const windDir = windDirDeg != null ? windDegToCardinal(windDirDeg) : undefined

    // Données structurées pour la simulation (ordre hourly = celui des params)
    const hourlyTime = range(Number(hourly.time()), Number(hourly.timeEnd()), hourly.interval()).map(
      (t) => new Date((t + utcOffsetSeconds) * 1000)
    )
    const weatherData = {
      current: {
        time: new Date((Number(current.time()) + utcOffsetSeconds) * 1000),
        temp: current.variables(0)?.value(),
        feels_like: current.variables(1)?.value(),
        is_day: current.variables(2)?.value(),
        precip: current.variables(3)?.value(),
        wind: current.variables(4)?.value(),
        gusts: current.variables(5)?.value(),
      },
      hourly: {
        time: hourlyTime,
        temperature_2m: hourly.variables(0)?.valuesArray() ?? [],
        apparent_temperature: hourly.variables(1)?.valuesArray() ?? [],
        precipitation: hourly.variables(2)?.valuesArray() ?? [],
        snowfall: hourly.variables(3)?.valuesArray() ?? [],
        rain: hourly.variables(4)?.valuesArray() ?? [],
        wind_speed_10m: hourly.variables(5)?.valuesArray() ?? [],
        wind_gusts_10m: hourly.variables(6)?.valuesArray() ?? [],
        soil_moisture: hourly.variables(7)?.valuesArray() ?? [],
        freezing_level: hourly.variables(8)?.valuesArray() ?? [],
      },
      daily: {
        sunrise: getDailyDate(daily.variables(0), utcOffsetSeconds),
        sunset: getDailyDate(daily.variables(1), utcOffsetSeconds),
        daylight_duration: daily.variables(2)?.valuesArray() ?? [],
      },
    }

    res.setHeader('Cache-Control', `public, max-age=${CACHE_TTL_SECONDS}, s-maxage=${CACHE_TTL_SECONDS}`)
    return res.status(200).json({
      // Compatibilité existante (header, SingleCoursePage, xweather)
      tempC: Number(tempC),
      icon: icon ?? undefined,
      rainLast24h: rainLast24h ?? undefined,
      windSpeedKmh: windSpeedKmh ?? undefined,
      windDirDeg: windDirDeg ?? undefined,
      windDir: windDir ?? undefined,
      // Données riches pour la simulation
      weatherData,
    })
  } catch (err) {
    console.error('Erreur météo Open-Meteo', err)
    return res.status(500).json({
      error: 'Erreur serveur météo',
      message: err instanceof Error ? err.message : 'Erreur inconnue',
    })
  }
}
