import { createClient } from '@supabase/supabase-js'

// Configuration Supabase
const supabaseUrl = 'https://bzltfvqzquqkvfnwcmmr.supabase.co'
const supabaseAnonKey = 'sb_publishable_uU3vmqDdKuULADE7bGzRow_aEsu4F2N'

// Client Supabase avec gestion des erreurs CORS
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false, // Désactiver la détection automatique pour éviter les appels répétés
  },
})

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
  strava_route_id: string | null
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
