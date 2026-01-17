import type { StravaMetrics } from '../types/strava'

/**
 * Calcule une estimation de la performance du coureur sur le profil de la course
 * Basé sur les métriques Strava et le profil d'élévation de la course
 */
export function estimateRunnerPerformance(
  profile: Array<[number, number]>,
  metrics: StravaMetrics | null
): Array<[number, number]> {
  if (!metrics || profile.length === 0) {
    return profile // Retourner le profil original si pas de métriques
  }

  // Calculer la vitesse moyenne du coureur (basée sur ses sorties longues)
  // Estimation : si le coureur fait X km en Y heures, sa vitesse moyenne est X/Y
  // Pour simplifier, on utilise une estimation basée sur le volume hebdo
  const avgPaceKmPerH = metrics.kmPerWeek > 0 ? Math.max(8, Math.min(12, 10 - metrics.kmPerWeek / 100)) : 10 // Entre 8 et 12 km/h

  // Calculer le ratio de capacité D+ du coureur
  // Si le coureur fait X m D+ sur Y km, son ratio est X/Y
  const courseTotalDPlus = profile[profile.length - 1] ? profile.reduce((max, [, ele]) => Math.max(max, ele), 0) - profile[0][1] : 0
  const courseTotalDistance = profile[profile.length - 1] ? profile[profile.length - 1][0] : 0
  
  // Ratio D+ du coureur basé sur ses sorties longues
  const runnerDPlusRatio = metrics.longRunDistanceKm > 0 
    ? metrics.longRunDPlus / metrics.longRunDistanceKm 
    : metrics.dPlusPerWeek / Math.max(metrics.kmPerWeek, 1)

  // Ratio D+ de la course
  const courseDPlusRatio = courseTotalDistance > 0 ? courseTotalDPlus / courseTotalDistance : 0

  // Facteur d'ajustement : si le coureur a un ratio D+ inférieur à la course, il sera plus lent en montée
  const dPlusAdjustmentFactor = courseDPlusRatio > 0 && runnerDPlusRatio > 0
    ? Math.min(1.2, Math.max(0.7, runnerDPlusRatio / courseDPlusRatio))
    : 1

  // Calculer l'estimation point par point
  const estimatedProfile: Array<[number, number]> = []
  let cumulativeTime = 0 // Temps cumulé en heures
  let previousDistance = 0
  let previousElevation = profile[0] ? profile[0][1] : 0

  profile.forEach(([distance, elevation], index) => {
    if (index === 0) {
      estimatedProfile.push([distance, elevation])
      return
    }

    const segmentDistance = distance - previousDistance // Distance du segment en km
    const segmentElevation = elevation - previousElevation // D+ du segment en m
    
    // Ajuster la vitesse selon le dénivelé
    // Plus de D+ = plus lent
    const elevationFactor = segmentElevation > 0 
      ? 1 - (segmentElevation / segmentDistance) * 0.05 * (1 - dPlusAdjustmentFactor) // Ralentissement en montée
      : 1 + Math.abs(segmentElevation / segmentDistance) * 0.02 // Légère accélération en descente

    const adjustedPace = avgPaceKmPerH * elevationFactor
    const segmentTime = segmentDistance / adjustedPace // Temps en heures

    cumulativeTime += segmentTime

    // L'élévation estimée reste la même (on suit le profil)
    // Mais on pourrait ajuster si le coureur ne peut pas monter aussi haut
    estimatedProfile.push([distance, elevation])

    previousDistance = distance
    previousElevation = elevation
  })

  return estimatedProfile
}

/**
 * Calcule une estimation simplifiée : ligne qui suit le profil mais avec un décalage
 * basé sur les capacités du coureur
 * La ligne représente la performance estimée du coureur sur le tracé
 */
export function estimateRunnerElevationLine(
  profile: Array<[number, number]>,
  metrics: StravaMetrics | null
): Array<[number, number]> {
  if (!metrics || profile.length === 0) {
    return []
  }

  const baseElevation = profile[0] ? profile[0][1] : 0
  const maxElevation = profile.reduce((max, [, ele]) => Math.max(max, ele), baseElevation)
  const courseTotalDPlus = maxElevation - baseElevation
  const courseTotalDistance = profile[profile.length - 1] ? profile[profile.length - 1][0] : 1

  // Capacité du coureur basée sur ses sorties longues (ratio D+/km)
  const runnerDPlusPerKm = metrics.longRunDistanceKm > 0 && metrics.longRunDPlus > 0
    ? metrics.longRunDPlus / metrics.longRunDistanceKm
    : metrics.dPlusPerWeek / Math.max(metrics.kmPerWeek, 1)

  const courseDPlusPerKm = courseTotalDistance > 0 ? courseTotalDPlus / courseTotalDistance : 0

  // Facteur de capacité : 1.0 = même niveau, < 1.0 = moins capable, > 1.0 = plus capable
  // On limite entre 0.6 et 1.2 pour éviter des écarts trop importants
  const capacityFactor = courseDPlusPerKm > 0 
    ? Math.min(1.2, Math.max(0.6, runnerDPlusPerKm / courseDPlusPerKm))
    : 1

  // Créer une ligne estimée qui suit le profil mais ajustée selon la capacité
  // Si le coureur est moins capable (capacityFactor < 1), la ligne sera légèrement en dessous
  // Si le coureur est plus capable (capacityFactor > 1), la ligne sera similaire ou légèrement au-dessus
  const estimatedLine: Array<[number, number]> = profile.map(([distance, elevation]) => {
    // Calculer le D+ relatif à ce point
    const relativeElevation = elevation - baseElevation
    
    // Ajuster selon la capacité : si capacityFactor < 1, réduire légèrement l'élévation
    // On applique un facteur d'ajustement progressif (max 20% de différence)
    const adjustment = 1 - (1 - capacityFactor) * 0.2
    const adjustedElevation = baseElevation + relativeElevation * adjustment
    
    return [distance, adjustedElevation]
  })

  return estimatedLine
}
