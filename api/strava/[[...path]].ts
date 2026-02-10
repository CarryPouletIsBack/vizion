import type { VercelRequest, VercelResponse } from '@vercel/node'
import { configHandler } from '../../server/strava-handlers/config'
import { tokenHandler } from '../../server/strava-handlers/token'
import { activitiesHandler } from '../../server/strava-handlers/activities'
import { activityDetailsHandler } from '../../server/strava-handlers/activity-details'
import { athleteHandler } from '../../server/strava-handlers/athlete'
import { routeSegmentsHandler } from '../../server/strava-handlers/route-segments'
import { routePerformanceHandler } from '../../server/strava-handlers/route-performance'

const handlers: Record<string, (req: VercelRequest, res: VercelResponse) => Promise<void | VercelResponse>> = {
  config: configHandler as (req: VercelRequest, res: VercelResponse) => Promise<void | VercelResponse>,
  token: tokenHandler as (req: VercelRequest, res: VercelResponse) => Promise<void | VercelResponse>,
  activities: activitiesHandler as (req: VercelRequest, res: VercelResponse) => Promise<void | VercelResponse>,
  'activity-details': activityDetailsHandler as (req: VercelRequest, res: VercelResponse) => Promise<void | VercelResponse>,
  athlete: athleteHandler as (req: VercelRequest, res: VercelResponse) => Promise<void | VercelResponse>,
  'route-segments': routeSegmentsHandler as (req: VercelRequest, res: VercelResponse) => Promise<void | VercelResponse>,
  'route-performance': routePerformanceHandler as (req: VercelRequest, res: VercelResponse) => Promise<void | VercelResponse>,
}

function getPathSegment(req: VercelRequest): string {
  const path = (req.query.path as string[] | undefined)
  if (Array.isArray(path) && path[0]) return path[0]
  try {
    const pathname = new URL(req.url || '/', 'http://x').pathname
    const match = pathname.match(/\/api\/strava\/([^/?#]+)/)
    return match ? match[1] : ''
  } catch {
    return ''
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const segment = getPathSegment(req)
  const handlerFn = handlers[segment]
  if (!handlerFn) {
    return res.status(404).json({ error: 'Not found', path: segment })
  }
  return handlerFn(req, res)
}
