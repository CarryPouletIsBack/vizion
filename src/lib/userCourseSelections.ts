import { supabase } from './supabase'
import { getCurrentUser } from './auth'

/**
 * Ajouter un parcours à "Mes parcours" (choix de l'utilisateur)
 */
export async function addCourseToMyParcours(courseId: string): Promise<{ success: boolean; error?: string }> {
  const user = await getCurrentUser()
  if (!user?.id) {
    return { success: false, error: 'Connectez-vous pour ajouter un parcours à votre liste.' }
  }
  const { error } = await supabase.from('user_course_selections').upsert(
    { user_id: user.id, course_id: courseId },
    { onConflict: 'user_id,course_id' }
  )
  if (error) {
    console.error('[userCourseSelections] Erreur:', error)
    return { success: false, error: error.message }
  }
  return { success: true }
}

/**
 * Retirer un parcours de "Mes parcours"
 */
export async function removeCourseFromMyParcours(courseId: string): Promise<{ success: boolean; error?: string }> {
  const user = await getCurrentUser()
  if (!user?.id) return { success: false, error: 'Non connecté' }
  const { error } = await supabase
    .from('user_course_selections')
    .delete()
    .eq('user_id', user.id)
    .eq('course_id', courseId)
  if (error) {
    console.error('[userCourseSelections] Erreur:', error)
    return { success: false, error: error.message }
  }
  return { success: true }
}

/**
 * Vérifier si un parcours est dans "Mes parcours" (créé par l'utilisateur ou choisi)
 */
export async function isCourseInMyParcours(
  courseId: string,
  createdByUserId?: string | null
): Promise<boolean> {
  const user = await getCurrentUser()
  if (!user?.id) return false
  if (createdByUserId === user.id) return true
  const { data } = await supabase
    .from('user_course_selections')
    .select('id')
    .eq('user_id', user.id)
    .eq('course_id', courseId)
    .maybeSingle()
  return !!data
}

/**
 * Récupérer les IDs des parcours choisis par l'utilisateur
 */
export async function getMySelectedCourseIds(): Promise<Set<string>> {
  const user = await getCurrentUser()
  if (!user?.id) return new Set()
  const { data } = await supabase
    .from('user_course_selections')
    .select('course_id')
    .eq('user_id', user.id)
  if (!data) return new Set()
  return new Set(data.map((r) => r.course_id as string))
}
