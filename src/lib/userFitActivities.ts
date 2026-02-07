import { supabase } from './supabase'

/** Résumé d'une activité .fit (aligné avec FitActivitySummary en page). */
export type FitActivitySummary = {
  distanceKm: number | null
  durationSec: number | null
  ascentM: number | null
  sport: string | null
}

export type UserFitActivityRow = {
  id: string
  user_id: string
  file_name: string
  summary: FitActivitySummary
  imported_at: string
}

/** Score pour trier "sorties les plus longues" (distance + D+ pondéré). */
export function fitLongRunScore(summary: FitActivitySummary): number {
  const km = summary.distanceKm ?? 0
  const dplus = summary.ascentM ?? 0
  return km * 10 + dplus * 0.003
}

/**
 * Enregistre une activité .fit pour l'utilisateur connecté.
 */
export async function saveUserFitActivity(
  userId: string,
  fileName: string,
  summary: FitActivitySummary
): Promise<UserFitActivityRow | null> {
  const { data, error } = await supabase
    .from('user_fit_activities')
    .insert({
      user_id: userId,
      file_name: fileName,
      summary: {
        distanceKm: summary.distanceKm,
        durationSec: summary.durationSec,
        ascentM: summary.ascentM,
        sport: summary.sport,
      },
    })
    .select('id, user_id, file_name, summary, imported_at')
    .single()

  if (error) {
    console.warn('saveUserFitActivity:', error)
    return null
  }
  return data as UserFitActivityRow
}

/**
 * Récupère toutes les activités .fit de l'utilisateur, triées par "longueur" (les plus longues en premier).
 */
export async function getUserFitActivities(userId: string): Promise<UserFitActivityRow[]> {
  const { data, error } = await supabase
    .from('user_fit_activities')
    .select('id, user_id, file_name, summary, imported_at')
    .eq('user_id', userId)
    .order('imported_at', { ascending: false })

  if (error) {
    console.warn('getUserFitActivities:', error)
    return []
  }

  const rows = (data ?? []) as UserFitActivityRow[]
  rows.sort((a, b) => fitLongRunScore(b.summary) - fitLongRunScore(a.summary))
  return rows
}

/**
 * Supprime une activité .fit de l'utilisateur.
 */
export async function deleteUserFitActivity(userId: string, id: string): Promise<boolean> {
  const { error } = await supabase
    .from('user_fit_activities')
    .delete()
    .eq('user_id', userId)
    .eq('id', id)

  if (error) {
    console.warn('deleteUserFitActivity:', error)
    return false
  }
  return true
}
