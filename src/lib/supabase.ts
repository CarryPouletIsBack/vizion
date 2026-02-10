import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL ?? ''
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY ?? ''
/** True si VITE_SUPABASE_URL et VITE_SUPABASE_ANON_KEY sont définis (évite d’appeler le client si non configuré). */
export const supabaseConfigured = supabaseUrl.length > 0 && supabaseAnonKey.length > 0
const configured = supabaseConfigured

const MSG = 'Supabase non configuré : ajoutez VITE_SUPABASE_URL et VITE_SUPABASE_ANON_KEY dans votre fichier .env (voir .env.example).'

function throwNotConfigured(): never {
  throw new Error(MSG)
}

// Client Supabase — créé uniquement si URL et clé sont définis (sinon proxy qui throw à l’utilisation)
export const supabase: SupabaseClient = configured
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
      },
    })
  : (new Proxy({} as SupabaseClient, { get: () => throwNotConfigured }) as SupabaseClient)

// Types pour les tables
export type EventRow = {
  id: string
  name: string
  country: string
  start_label: string
  image_url: string | null
  created_at: string
  updated_at: string
}

export type CourseRow = {
  id: string
  event_id: string
  name: string
  image_url: string | null
  gpx_name: string | null
  gpx_svg: string | null
  distance_km: number | null
  elevation_gain: number | null
  profile: Array<[number, number]> | null
  start_coordinates: [number, number] | null // [lat, lon]
  gpx_bounds: { minLat: number; maxLat: number; minLon: number; maxLon: number } | null
  /** Date de la course (YYYY-MM-DD) pour météo et simulation. Si la table n'a pas la colonne : ALTER TABLE courses ADD COLUMN date text, ADD COLUMN start_time text; */
  date: string | null
  /** Heure de départ (HH:mm) imposée par l'organisation */
  start_time: string | null
  strava_route_id: string | null
  created_by_user_id: string | null
  is_published: boolean
  strava_segments: string | Array<{
    id: number
    name: string
    distance: number
    elevation_gain: number
    average_grade: number
    type: 'climb' | 'descent' | 'flat'
  }> | null
  created_at: string
  updated_at: string
}
