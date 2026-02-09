/**
 * Exporte les events et courses depuis Supabase vers un fichier JSON local
 * pour pouvoir visualiser les données sans être connecté à la BDD.
 *
 * Usage (à la racine du projet) :
 *   node scripts/export-courses-from-supabase.mjs
 *
 * Les variables VITE_SUPABASE_URL et VITE_SUPABASE_ANON_KEY doivent être
 * définies (fichier .env ou export shell).
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')

// Charger .env si présent
function loadEnv() {
  const envPath = join(root, '.env')
  if (!existsSync(envPath)) return
  const content = readFileSync(envPath, 'utf8')
  content.split('\n').forEach((line) => {
    const m = line.match(/^([^#=]+)=(.*)$/)
    if (m) {
      const key = m[1].trim()
      const val = m[2].trim().replace(/^["']|["']$/g, '')
      if (!process.env[key]) process.env[key] = val
    }
  })
}
loadEnv()

const supabaseUrl = process.env.VITE_SUPABASE_URL ?? 'https://bzltfvqzquqkvfnwcmmr.supabase.co'
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY ?? ''

if (!supabaseAnonKey) {
  console.error('Définir VITE_SUPABASE_ANON_KEY (ou dans .env)')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseAnonKey)

function parseProfile(profile) {
  if (profile == null) return undefined
  if (typeof profile === 'string') {
    try {
      return JSON.parse(profile)
    } catch {
      return undefined
    }
  }
  return Array.isArray(profile) ? profile : undefined
}

function parseStravaSegments(stravaSegments) {
  if (stravaSegments == null) return undefined
  if (typeof stravaSegments === 'string') {
    try {
      return JSON.parse(stravaSegments)
    } catch {
      return undefined
    }
  }
  return Array.isArray(stravaSegments) ? stravaSegments : undefined
}

async function main() {
  console.log('Chargement des events et courses depuis Supabase...')

  const { data: eventsData, error: eventsError } = await supabase
    .from('events')
    .select('*')
    .order('created_at', { ascending: false })

  if (eventsError) {
    console.error('Erreur events:', eventsError.message)
    process.exit(1)
  }

  const { data: coursesData, error: coursesError } = await supabase
    .from('courses')
    .select('*')
    .order('created_at', { ascending: false })

  if (coursesError) {
    console.error('Erreur courses:', coursesError.message)
    process.exit(1)
  }

  const eventsMap = new Map()
  for (const e of eventsData || []) {
    eventsMap.set(e.id, {
      id: e.id,
      name: e.name,
      country: e.country,
      startLabel: e.start_label,
      imageUrl: e.image_url || undefined,
      courses: [],
    })
  }

  for (const c of coursesData || []) {
    const event = eventsMap.get(c.event_id)
    if (!event) continue
    const profile = parseProfile(c.profile)
    const stravaSegments = parseStravaSegments(c.strava_segments)
    const startCoordinates =
      c.start_coordinates && Array.isArray(c.start_coordinates) && c.start_coordinates.length === 2
        ? [c.start_coordinates[0], c.start_coordinates[1]]
        : undefined
    const gpxBounds =
      c.gpx_bounds && typeof c.gpx_bounds === 'object' && 'minLat' in c.gpx_bounds ? c.gpx_bounds : undefined
    event.courses.push({
      id: c.id,
      name: c.name,
      imageUrl: c.image_url || undefined,
      gpxName: c.gpx_name || undefined,
      gpxSvg: c.gpx_svg || undefined,
      distanceKm: c.distance_km ?? undefined,
      elevationGain: c.elevation_gain ?? undefined,
      profile,
      stravaRouteId: c.strava_route_id || undefined,
      stravaSegments,
      startCoordinates,
      gpxBounds,
      date: c.date ?? undefined,
      startTime: c.start_time ?? undefined,
    })
  }

  const out = Array.from(eventsMap.values())
  const outPath = join(root, 'public', 'data', 'localEventsAndCourses.json')
  mkdirSync(dirname(outPath), { recursive: true })
  writeFileSync(outPath, JSON.stringify(out, null, 2), 'utf8')
  console.log('Écrit:', outPath)
  console.log('Events:', out.length, '| Courses:', out.reduce((s, e) => s + e.courses.length, 0))
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
