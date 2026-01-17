/**
 * Calcule la technicité d'un segment du profil d'élévation
 * Basé sur la pente : > 25% montée ou > -20% descente = technique
 */

export type TechnicityLevel = 'smooth' | 'technical' | 'chaos'

export type ProfileSegment = {
  startDistance: number
  endDistance: number
  technicity: TechnicityLevel
  grade: number // Pente en pourcentage
}

/**
 * Analyse un profil d'élévation pour identifier les segments techniques
 */
export function analyzeProfileTechnicity(
  profile: Array<[number, number]> // Array de [distance, elevation]
): ProfileSegment[] {
  if (profile.length < 2) return []

  const segments: ProfileSegment[] = []

  for (let i = 1; i < profile.length; i += 1) {
    const [dist1, elev1] = profile[i - 1]
    const [dist2, elev2] = profile[i]

    const distance = dist2 - dist1
    const elevation = elev2 - elev1

    if (distance <= 0) continue

    // Calculer la pente en pourcentage
    const grade = (elevation / distance) * 100

    // Déterminer la technicité selon la pente
    let technicity: TechnicityLevel
    if (Math.abs(grade) > 25 || grade < -20) {
      // Pente > 25% montée ou > -20% descente = Chaos/Rochers
      technicity = 'chaos'
    } else if (Math.abs(grade) > 15 || grade < -12) {
      // Pente > 15% montée ou > -12% descente = Technique
      technicity = 'technical'
    } else {
      // Pente plus douce = Roulant
      technicity = 'smooth'
    }

    segments.push({
      startDistance: dist1,
      endDistance: dist2,
      technicity,
      grade,
    })
  }

  return segments
}

/**
 * Retourne la couleur pour un niveau de technicité
 */
export function getTechnicityColor(technicity: TechnicityLevel): string {
  switch (technicity) {
    case 'smooth':
      return '#22c55e' // Vert = Roulant
    case 'technical':
      return '#f59e0b' // Orange = Technique
    case 'chaos':
      return '#ef4444' // Rouge = Chaos/Rochers
    default:
      return '#9ca3af'
  }
}

/**
 * Retourne le nom pour un niveau de technicité
 */
export function getTechnicityLabel(technicity: TechnicityLevel): string {
  switch (technicity) {
    case 'smooth':
      return 'Roulant'
    case 'technical':
      return 'Technique'
    case 'chaos':
      return 'Chaos/Rochers'
    default:
      return 'Inconnu'
  }
}
