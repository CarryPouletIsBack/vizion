import FitParser from 'fit-file-parser'
import type { FitActivitySummary } from './userFitActivities'

type ParsedData = {
  sessions?: Array<{ [k: string]: unknown }>
  activity?: { sessions?: Array<{ [k: string]: unknown }>; laps?: Array<{ [k: string]: unknown }> }
  laps?: Array<{ [k: string]: unknown }>
}

function getFitSummary(data: ParsedData): FitActivitySummary | null {
  const sessions = data.sessions ?? data.activity?.sessions
  const session = sessions?.[0] as { [k: string]: unknown } | undefined
  if (!session) {
    const lap = data.laps?.[0] ?? data.activity?.laps?.[0] as { [k: string]: unknown } | undefined
    if (lap) {
      const rawDist = lap.total_distance as number | undefined
      const rawTime = lap.total_elapsed_time as number | undefined
      const rawAscent = lap.total_ascent as number | undefined
      const distanceKm = rawDist != null ? (rawDist > 1000 ? rawDist / 1000 : rawDist) : null
      const durationSec = rawTime != null ? (rawTime > 1e6 ? Math.round(rawTime / 1000) : rawTime) : null
      const ascentM = rawAscent != null ? rawAscent : null
      const sport = (lap.sport as string) ?? null
      return { distanceKm, durationSec, ascentM, sport }
    }
    return null
  }
  const rawDist = session.total_distance as number | undefined
  const rawTime = session.total_elapsed_time as number | undefined
  const rawAscent = session.total_ascent as number | undefined
  const distanceKm = rawDist != null ? (rawDist > 1000 ? rawDist / 1000 : rawDist) : null
  const durationSec = rawTime != null ? (rawTime > 1e6 ? Math.round(rawTime / 1000) : rawTime) : null
  const ascentM = rawAscent != null ? rawAscent : null
  const sport = (session.sport as string) ?? null
  return { distanceKm, durationSec, ascentM, sport }
}

/**
 * Parse un fichier .fit (ArrayBuffer) et retourne un résumé activité, ou null.
 */
export async function parseFitFile(buffer: ArrayBuffer): Promise<FitActivitySummary | null> {
  const parser = new FitParser({
    mode: 'cascade',
    lengthUnit: 'km',
    speedUnit: 'km/h',
  })
  const data = await parser.parseAsync(buffer) as unknown as ParsedData
  return getFitSummary(data)
}
