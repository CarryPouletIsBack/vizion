import { supabase } from './supabase'

/**
 * Créer un compte utilisateur avec email et mot de passe
 */
export async function signUp(email: string, password: string) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
  })

  if (error) {
    throw new Error(error.message)
  }

  return data
}

/**
 * Se connecter avec email et mot de passe
 */
export async function signIn(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  if (error) {
    throw new Error(error.message)
  }

  return data
}

/**
 * Se déconnecter
 */
export async function signOut() {
  const { error } = await supabase.auth.signOut()
  if (error) {
    throw new Error(error.message)
  }
}

/**
 * Obtenir l'utilisateur actuellement connecté
 */
export async function getCurrentUser() {
  try {
    const { data: { user }, error } = await supabase.auth.getUser()
    if (error) {
      // Ne pas lancer d'erreur si l'utilisateur n'est pas authentifié (c'est normal)
      if (error.message.includes('JWT') || error.message.includes('token') || error.message.includes('session')) {
        return null
      }
      throw new Error(error.message)
    }
    return user
  } catch (error) {
    // Gérer les erreurs CORS et autres erreurs réseau silencieusement
    console.warn('Erreur lors de la récupération de l\'utilisateur:', error)
    return null
  }
}

/**
 * Écouter les changements d'authentification
 */
export function onAuthStateChange(callback: (user: any) => void) {
  return supabase.auth.onAuthStateChange((_event, session) => {
    callback(session?.user ?? null)
  })
}

/**
 * Mettre à jour le profil utilisateur
 */
export async function updateProfile(data: {
  email?: string
  firstname?: string
  lastname?: string
  birthdate?: string
}) {
  const updates: any = {}

  // Mettre à jour l'email si fourni
  if (data.email) {
    const { error: emailError } = await supabase.auth.updateUser({ email: data.email })
    if (emailError) {
      throw new Error(emailError.message)
    }
  }

  // Mettre à jour les métadonnées utilisateur
  if (data.firstname || data.lastname || data.birthdate) {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      throw new Error('Utilisateur non trouvé')
    }

    const currentMetadata = user.user_metadata || {}
    updates.user_metadata = {
      ...currentMetadata,
      ...(data.firstname !== undefined && { firstname: data.firstname }),
      ...(data.lastname !== undefined && { lastname: data.lastname }),
      ...(data.birthdate !== undefined && { birthdate: data.birthdate }),
    }
  }

  if (Object.keys(updates).length > 0) {
    const { error } = await supabase.auth.updateUser(updates)
    if (error) {
      throw new Error(error.message)
    }
  }
}

/**
 * Supprimer le compte utilisateur
 */
export async function deleteAccount() {
  const { error } = await supabase.auth.admin.deleteUser(
    (await supabase.auth.getUser()).data.user?.id || ''
  )
  
  if (error) {
    // Si l'admin API n'est pas disponible, utiliser l'API publique
    // Note: Cela nécessite généralement une confirmation par email
    throw new Error('La suppression de compte nécessite une confirmation. Contactez le support.')
  }
}
