import type { StravaMetrics } from '../types/strava'
import type { StravaSegment } from './stravaSegments'
import { estimateTrailTime, type TimeEstimate } from './trailTimeEstimator'
import { grandRaidStats, getCriticalAbandonPoints, getCriticalPointBeforeDistance, type GrandRaidStats } from '../data/grandRaidStats'

/**
 * Données d'une course pour l'analyse
 */
export type CourseData = {
  distanceKm: number
  elevationGain: number
  name?: string
}

/**
 * Résultat de l'analyse de préparation
 */
export type CourseAnalysis = {
  readiness: 'ready' | 'needs_work' | 'risk'
  readinessLabel: 'Prêt' | 'À renforcer' | 'Risque'
  recommendations: string[]
  issues: string[]
  strengths: string[]
  regularity: 'bonne' | 'moyenne' | 'faible'
  regularityDetails: string
  // Nouvelles données pour améliorer l'UX
  summary: string // Résumé en 1 phrase humaine
  immediateActions: string[] // Actions prioritaires immédiates
  secondaryActions: string[] // Actions importantes mais secondaires
  testActions: string[] // Actions à tester
  next4WeeksGoals: {
    volumeKm: { min: number; max: number }
    dPlus: { min: number; max: number }
    frequency: number
    longRunHours: number
  }
  projection: {
    ifContinues: {
      m3: 'ready' | 'needs_work' | 'risk'
      m1: 'ready' | 'needs_work' | 'risk'
    }
    ifFollowsGoals: {
      m3: 'ready' | 'needs_work' | 'risk'
      m1: 'ready' | 'needs_work' | 'risk'
    }
  }
  timeEstimate?: TimeEstimate // Estimation du temps de course
  coachVerdict?: string // Verdict du coach (phrase dynamique)
}

/**
 * Analyse la préparation du coureur pour une course donnée
 * Compare les métriques Strava avec les exigences de la course
 * Utilise les statistiques du Grand Raid Réunion 2025 pour affiner l'analyse
 */
export function analyzeCourseReadiness(
  metrics: StravaMetrics | null,
  course: CourseData,
  segments?: StravaSegment[],
  raceStats?: GrandRaidStats
): CourseAnalysis {
  // Utiliser les stats du Grand Raid par défaut si disponibles
  const stats = raceStats || (course.name?.toLowerCase().includes('grand raid') || course.name?.toLowerCase().includes('diagonale') ? grandRaidStats : undefined)
  
  // Si pas de métriques, retourner un état par défaut
  if (!metrics) {
    return {
      readiness: 'risk',
      readinessLabel: 'Risque',
      recommendations: ['Connectez-vous à Strava pour analyser votre préparation'],
      issues: ['Aucune donnée Strava disponible'],
      strengths: [],
      regularity: 'faible',
      regularityDetails: 'Aucune donnée disponible',
      summary: 'Connectez-vous à Strava pour obtenir une analyse personnalisée de votre préparation.',
      immediateActions: ['Connecter votre compte Strava'],
      secondaryActions: [],
      testActions: [],
      next4WeeksGoals: {
        volumeKm: { min: 20, max: 30 },
        dPlus: { min: 800, max: 1200 },
        frequency: 3,
        longRunHours: 2.5,
      },
      projection: {
        ifContinues: { m3: 'risk', m1: 'risk' },
        ifFollowsGoals: { m3: 'needs_work', m1: 'ready' },
      },
      timeEstimate: undefined, // Pas d'estimation sans métriques
    }
  }

  const issues: string[] = []
  const strengths: string[] = []
  const recommendations: string[] = []
  // Stocker temporairement les actions critiques basées sur les stats
  const tempImmediateActions: string[] = []

  // === ANALYSE DISTANCE ===
  const distanceRatio = metrics.longRunDistanceKm > 0 ? course.distanceKm / metrics.longRunDistanceKm : Infinity
  if (distanceRatio > 1.2) {
    issues.push(`Distance course (${course.distanceKm} km) > 120% de votre sortie max (${metrics.longRunDistanceKm} km)`)
    recommendations.push(`Augmenter progressivement la distance : objectif ${Math.round(course.distanceKm * 0.8)} km dans les prochaines semaines`)
  } else if (distanceRatio > 1.0) {
    recommendations.push(`Vous êtes proche de la distance cible. Planifier 1-2 sorties longues de ${Math.round(course.distanceKm * 0.7)} km`)
  } else {
    strengths.push(`Distance max entraînée (${metrics.longRunDistanceKm} km) couvre la course (${course.distanceKm} km)`)
  }

  // === ANALYSE DÉNIVELÉ ===
  if (course.elevationGain > metrics.longRunDPlus) {
    issues.push(`D+ course (${Math.round(course.elevationGain)} m) > D+ max entraîné (${Math.round(metrics.longRunDPlus)} m)`)
    recommendations.push(`Augmenter le travail en montée : objectif ${Math.round(course.elevationGain * 0.8)} m D+ sur une sortie`)
  } else {
    strengths.push(`D+ max entraîné (${Math.round(metrics.longRunDPlus)} m) couvre la course (${Math.round(course.elevationGain)} m)`)
  }

  // === ANALYSE VOLUME HEBDOMADAIRE ===
  const weeklyDistanceKm = metrics.kmPerWeek
  const weeklyElevationGain = metrics.dPlusPerWeek
  const courseWeeklyEquivalent = course.distanceKm / 6 // Distance à faire par semaine pour être prêt en 6 semaines

  if (weeklyDistanceKm < courseWeeklyEquivalent * 0.5) {
    issues.push(`Volume hebdo faible (${weeklyDistanceKm} km/sem) vs objectif (~${Math.round(courseWeeklyEquivalent)} km/sem)`)
    recommendations.push(`Augmenter le volume progressivement : objectif ${Math.round(courseWeeklyEquivalent * 0.7)} km/semaine`)
  } else if (weeklyDistanceKm < courseWeeklyEquivalent * 0.8) {
    recommendations.push(`Continuer à augmenter le volume : viser ${Math.round(courseWeeklyEquivalent)} km/semaine`)
  } else {
    strengths.push(`Volume hebdomadaire solide (${weeklyDistanceKm} km/semaine)`)
  }

  // === ANALYSE DÉNIVELÉ HEBDOMADAIRE ===
  const courseWeeklyDPlus = course.elevationGain / 6
  if (weeklyElevationGain < courseWeeklyDPlus * 0.5) {
    issues.push(`D+ hebdo faible (${Math.round(weeklyElevationGain)} m/sem) vs objectif (~${Math.round(courseWeeklyDPlus)} m/sem)`)
    recommendations.push(`Augmenter le D+ hebdomadaire : objectif ${Math.round(courseWeeklyDPlus * 0.7)} m/semaine`)
  } else if (weeklyElevationGain < courseWeeklyDPlus * 0.8) {
    recommendations.push(`Continuer à augmenter le D+ : viser ${Math.round(courseWeeklyDPlus)} m/semaine`)
  } else {
    strengths.push(`D+ hebdomadaire solide (${Math.round(weeklyElevationGain)} m/semaine)`)
  }

  // === ANALYSE RÉGULARITÉ ===
  const regularity = metrics.regularity
  let regularityDetails = ''
  if (regularity === 'faible') {
    issues.push('Régularité faible : moins de 2 sorties par semaine en moyenne')
    recommendations.push('Augmenter la fréquence : viser au moins 3-4 sorties par semaine')
    regularityDetails = 'Moins de 2 sorties par semaine en moyenne sur les 6 dernières semaines'
  } else if (regularity === 'moyenne') {
    recommendations.push('Maintenir la régularité : viser 4+ sorties par semaine')
    regularityDetails = '2-3 sorties par semaine en moyenne'
  } else {
    strengths.push('Régularité bonne : 4+ sorties par semaine')
    regularityDetails = '4+ sorties par semaine en moyenne'
  }

  // === ANALYSE SORTIES LONGUES ===
  const longRunThresholdMin = course.distanceKm * 0.4 // 40% de la distance de course
  if (metrics.longRunDistanceKm < longRunThresholdMin) {
    issues.push(`Sortie longue max (${metrics.longRunDistanceKm} km) < 40% de la course (${Math.round(longRunThresholdMin)} km)`)
    recommendations.push(`Planifier des sorties longues progressives : objectif ${Math.round(longRunThresholdMin)} km`)
  } else {
    strengths.push(`Sorties longues adaptées (max ${metrics.longRunDistanceKm} km)`)
  }

  // === ANALYSE VARIATION DE CHARGE ===
  if (metrics.variation < -20) {
    issues.push('Baisse importante de charge récente')
    recommendations.push('Reprendre progressivement l\'entraînement après la baisse de charge')
  } else if (metrics.variation > 30) {
    recommendations.push('Attention à l\'augmentation trop rapide de charge (risque de blessure)')
  }

  // === ESTIMATION DU TEMPS DE COURSE (calculé tôt pour être utilisé dans l'analyse) ===
  let timeEstimate: TimeEstimate | undefined
  try {
    timeEstimate = estimateTrailTime(
      {
        distanceKm: course.distanceKm,
        elevationGain: course.elevationGain,
        temperature: 15, // Température par défaut (peut être ajustée plus tard)
        bagWeight: 2, // Poids du sac par défaut : 2 kg
        refuelStops: Math.ceil(course.distanceKm / 20), // 1 ravitaillement tous les 20 km
        refuelTimePerStop: 2,
      },
      metrics
    )
  } catch (error) {
    console.warn('Erreur lors de l\'estimation du temps de course:', error)
    timeEstimate = undefined
  }

  // === ANALYSE POINTS D'ABANDON CRITIQUES (basée sur stats Grand Raid) ===
  if (stats) {
    // Identifier les points d'abandon critiques
    const criticalAbandonPoints = getCriticalAbandonPoints(stats, 3)
    if (criticalAbandonPoints.length > 0) {
      const topAbandonPoint = criticalAbandonPoints[0]
      issues.push(
        `Point d'abandon critique identifié : "${topAbandonPoint.name}" (${topAbandonPoint.distanceKm} km) - ${topAbandonPoint.abandons} abandons en 2025`
      )
      recommendations.push(
        `Préparer spécifiquement le passage de "${topAbandonPoint.name}" (${topAbandonPoint.distanceKm} km) - zone à fort taux d'abandon`
      )
      tempImmediateActions.push(
        `Zone critique "${topAbandonPoint.name}" : ${topAbandonPoint.abandons} abandons en 2025. Planifier une sortie spécifique sur ce secteur.`
      )
    }

    // Analyser les points critiques avant la distance actuelle du coureur
    if (metrics && metrics.longRunDistanceKm > 0) {
      const criticalBeforeDistance = getCriticalPointBeforeDistance(stats, metrics.longRunDistanceKm)
      if (criticalBeforeDistance && criticalBeforeDistance.abandons > 50) {
        recommendations.push(
          `Attention : "${criticalBeforeDistance.name}" (${criticalBeforeDistance.distanceKm} km) est un point d'abandon majeur avant votre distance max actuelle`
        )
      }
    }

    // === ANALYSE DES TEMPS DE PASSAGE RÉELS ===
    if (stats.checkpoints && stats.checkpoints.length > 0) {
      // Estimer le profil du coureur basé sur ses métriques
      const estimatedFinishTime = timeEstimate?.totalHours || 0
      let runnerProfile: 'elite' | 'fast' | 'average' | 'slow' = 'average'
      
      if (estimatedFinishTime > 0) {
        const eliteTime = stats.checkpoints[stats.checkpoints.length - 1]?.times.elite || 23.5
        const fastTime = stats.checkpoints[stats.checkpoints.length - 1]?.times.fast || 39.5
        const averageTime = stats.checkpoints[stats.checkpoints.length - 1]?.times.average || 49.9
        const slowTime = stats.checkpoints[stats.checkpoints.length - 1]?.times.slow || 66.0
        
        if (estimatedFinishTime <= eliteTime * 1.1) {
          runnerProfile = 'elite'
        } else if (estimatedFinishTime <= fastTime * 1.1) {
          runnerProfile = 'fast'
        } else if (estimatedFinishTime <= averageTime * 1.1) {
          runnerProfile = 'average'
        } else {
          runnerProfile = 'slow'
        }
      }

      // Identifier les segments critiques où les coureurs ralentissent le plus
      const criticalSegments: Array<{ name: string; distanceKm: number; speedDrop: number }> = []
      
      for (let i = 1; i < stats.checkpoints.length; i++) {
        const prev = stats.checkpoints[i - 1]
        const curr = stats.checkpoints[i]
        const segmentDistance = curr.distanceKm - prev.distanceKm
        
        if (segmentDistance > 0) {
          // Calculer la baisse de vitesse relative entre élite et moyen
          const eliteSpeed = curr.segmentSpeeds.elite
          const averageSpeed = curr.segmentSpeeds.average
          const speedDrop = eliteSpeed > 0 ? ((eliteSpeed - averageSpeed) / eliteSpeed) * 100 : 0
          
          // Si la baisse de vitesse est > 30%, c'est un segment critique
          if (speedDrop > 30 && curr.segmentSpeeds.average < 5) {
            criticalSegments.push({
              name: curr.name,
              distanceKm: curr.distanceKm,
              speedDrop: Math.round(speedDrop),
            })
          }
        }
      }

      // Ajouter des recommandations basées sur les segments critiques
      if (criticalSegments.length > 0) {
        const topCritical = criticalSegments.sort((a, b) => b.speedDrop - a.speedDrop)[0]
        issues.push(
          `Segment critique identifié : "${topCritical.name}" (${topCritical.distanceKm} km) - ralentissement de ${topCritical.speedDrop}% par rapport aux élites`
        )
        recommendations.push(
          `Travailler spécifiquement le secteur "${topCritical.name}" : les coureurs moyens ralentissent de ${topCritical.speedDrop}% sur ce segment`
        )
        
        // Ajouter une action immédiate si c'est un segment très critique
        if (topCritical.speedDrop > 50) {
          tempImmediateActions.push(
            `Segment très critique "${topCritical.name}" : ralentissement de ${topCritical.speedDrop}%. Planifier un travail spécifique sur ce secteur.`
          )
        }
      }

      // Calculer des barrières horaires basées sur les temps réels
      if (runnerProfile !== 'elite' && stats.checkpoints.length > 0) {
        const targetCheckpoint = stats.checkpoints.find((cp) => cp.distanceKm >= course.distanceKm * 0.5)
        if (targetCheckpoint) {
          const targetTime = targetCheckpoint.times[runnerProfile]
          const currentLongRunTime = metrics.longRunDistanceKm > 0 
            ? (metrics.longRunDistanceKm / 8) // Estimation : 8 km/h en moyenne
            : 0
            
          if (currentLongRunTime > 0 && targetTime > 0) {
            const timeRatio = currentLongRunTime / targetTime
            if (timeRatio > 1.2) {
              issues.push(
                `Temps estimé à mi-parcours (${Math.round(targetTime)}h) > 120% de votre capacité actuelle (${Math.round(currentLongRunTime)}h)`
              )
              recommendations.push(
                `Objectif intermédiaire : atteindre "${targetCheckpoint.name}" en ${Math.round(targetTime)}h. Votre niveau actuel prévoit ${Math.round(currentLongRunTime)}h.`
              )
            }
          }
        }
      }
    }
  }

  // === ANALYSE DES SEGMENTS CRITIQUES ===
  if (segments && segments.length > 0) {
    // Analyser les segments critiques
    const criticalClimbs = segments.filter(
      (seg) =>
        seg.type === 'climb' &&
        seg.elevation_gain > 0 &&
        (seg.elevation_gain > metrics.longRunDPlus || seg.average_grade > 20 || (seg.distance / 1000 > 5 && seg.elevation_gain > 500))
    )

    const criticalDescents = segments.filter(
      (seg) =>
        seg.type === 'descent' &&
        seg.elevation_gain < 0 &&
        (Math.abs(seg.average_grade) > 30 || (Math.abs(seg.elevation_gain) > 500 && seg.distance / 1000 < 3))
    )

    // Analyser les performances sur les segments critiques (si disponibles)
    const segmentsWithPerformance = segments.filter((seg) => seg.best_time || seg.average_time)
    if (segmentsWithPerformance.length > 0) {
      const slowSegments = segmentsWithPerformance.filter((seg) => {
        // Un segment est "lent" si le temps moyen est > 120% du temps théorique basé sur la distance
        if (!seg.average_time || !seg.distance) return false
        const theoreticalTime = (seg.distance / 1000) * 360 // Estimation : 10 km/h = 360s/km
        return seg.average_time > theoreticalTime * 1.2
      })

      if (slowSegments.length > 0) {
        issues.push(`${slowSegments.length} segment(s) avec performance faible détecté(s)`)
        recommendations.push(`Travailler spécifiquement les segments lents : ${slowSegments.slice(0, 3).map((s) => s.name).join(', ')}`)
      }

      // Analyser la progression (si plusieurs tentatives)
      const improvingSegments = segmentsWithPerformance.filter((seg) => seg.attempts && seg.attempts > 1 && seg.best_time && seg.average_time && seg.best_time < seg.average_time * 0.9)
      if (improvingSegments.length > 0) {
        strengths.push(`Progression détectée sur ${improvingSegments.length} segment(s)`)
      }
    }

    if (criticalClimbs.length > 0) {
      const longestClimb = criticalClimbs.reduce((max, seg) => (seg.distance > max.distance ? seg : max), criticalClimbs[0])
      issues.push(
        `Montée critique : "${longestClimb.name}" (${(longestClimb.distance / 1000).toFixed(1)} km, +${Math.round(longestClimb.elevation_gain)} m, ${longestClimb.average_grade.toFixed(1)}%)`
      )
      recommendations.push(`Travailler spécifiquement la montée "${longestClimb.name}" (pente ${longestClimb.average_grade.toFixed(1)}%)`)
    }

    if (criticalDescents.length > 0) {
      const steepestDescent = criticalDescents.reduce(
        (max, seg) => (Math.abs(seg.average_grade) > Math.abs(max.average_grade) ? seg : max),
        criticalDescents[0]
      )
      issues.push(
        `Descente technique : "${steepestDescent.name}" (${(steepestDescent.distance / 1000).toFixed(1)} km, ${Math.round(Math.abs(steepestDescent.elevation_gain))} m, ${Math.abs(steepestDescent.average_grade).toFixed(1)}%)`
      )
      recommendations.push(`Travailler la technique de descente sur "${steepestDescent.name}" (pente ${Math.abs(steepestDescent.average_grade).toFixed(1)}%)`)
    }

    if (criticalClimbs.length > 3) {
      recommendations.push(`Attention : ${criticalClimbs.length} montées critiques identifiées sur le parcours`)
    }
  }

  // === RECOMMANDATIONS GÉNÉRALES ===
  if (metrics.longRunDistanceKm < 20) {
    recommendations.push('Ajouter 2 sorties > 4h dans les prochaines semaines')
  }
  if (weeklyElevationGain < 2000) {
    recommendations.push('Augmenter le travail en descente et en terrain technique')
  }
  recommendations.push('Tester la nutrition sur effort long (>3h)')

  // === DÉTERMINATION DU STATUT ===
  let readiness: 'ready' | 'needs_work' | 'risk'
  let readinessLabel: 'Prêt' | 'À renforcer' | 'Risque'

  const criticalIssues = issues.filter((issue) => {
    return (
      issue.includes('> 120%') ||
      issue.includes('> D+ max') ||
      issue.includes('Volume hebdo faible') ||
      issue.includes('Régularité faible')
    )
  })

  if (criticalIssues.length >= 2) {
    readiness = 'risk'
    readinessLabel = 'Risque'
  } else if (issues.length > 0 || recommendations.length > 3) {
    readiness = 'needs_work'
    readinessLabel = 'À renforcer'
  } else {
    readiness = 'ready'
    readinessLabel = 'Prêt'
  }

  // === GÉNÉRATION DU RÉSUMÉ EN 1 PHRASE ===
  // Calculer le ratio de couverture de manière stricte et réaliste
  // Pour une course de 175 km / 10150 D+, les exigences minimales sérieuses sont élevées
  
  // === CALCUL RELATIF À LA COURSE (approche coach F1) ===
  // Les seuils sont maintenant adaptés à chaque course, pas fixes
  
  // 1. Score de distance hebdomadaire (relatif à la course)
  // Pour une course de X km, il faut au minimum X/6 km/semaine (6 mois de préparation)
  // Minimum réaliste : max(20% de la course, 15 km/semaine) pour les petites courses
  // Pour une course de 6km : min = max(1.2km, 15km) = 15km, mais on adapte : 6km/sem suffit
  const minDistanceWeekly = Math.max(course.distanceKm * 0.2, Math.min(15, course.distanceKm * 1.5)) // Adaptatif
  const idealDistanceWeekly = courseWeeklyEquivalent * 0.7 // 70% de l'exigence finale
  let distanceCoverage = 0
  if (weeklyDistanceKm >= idealDistanceWeekly) {
    distanceCoverage = 1.0 // Excellent
  } else if (weeklyDistanceKm >= minDistanceWeekly) {
    distanceCoverage = 0.5 + (weeklyDistanceKm - minDistanceWeekly) / (idealDistanceWeekly - minDistanceWeekly) * 0.5
  } else {
    // Pour les petites courses, être plus tolérant : si on court 2x la distance de la course par semaine, c'est bon
    const relativeDistance = course.distanceKm > 0 ? weeklyDistanceKm / course.distanceKm : 0
    if (relativeDistance >= 2.0) {
      distanceCoverage = 0.8 // Si on court 2x la distance de la course par semaine, c'est très bien
    } else if (relativeDistance >= 1.0) {
      distanceCoverage = 0.5 + (relativeDistance - 1.0) * 0.3 // Entre 1x et 2x : progression
    } else {
      distanceCoverage = Math.max(0, relativeDistance * 0.5) // En dessous de 1x : max 50%
    }
  }
  
  // 2. Score de D+ hebdomadaire (relatif à la course)
  // Pour une course de X m D+, il faut au minimum X/6 m/semaine
  // Minimum réaliste : max(20% du D+ de la course, 300 m/semaine) pour les petites courses
  const minDPlusWeekly = Math.max(course.elevationGain * 0.2, Math.min(300, course.elevationGain * 1.5)) // Adaptatif
  const idealDPlusWeekly = courseWeeklyDPlus * 0.7 // 70% de l'exigence finale
  let elevationCoverage = 0
  if (weeklyElevationGain >= idealDPlusWeekly) {
    elevationCoverage = 1.0 // Excellent
  } else if (weeklyElevationGain >= minDPlusWeekly) {
    elevationCoverage = 0.5 + (weeklyElevationGain - minDPlusWeekly) / (idealDPlusWeekly - minDPlusWeekly) * 0.5
  } else {
    // Pour les petites courses, être plus tolérant : si on fait 2x le D+ de la course par semaine, c'est bon
    const relativeDPlus = course.elevationGain > 0 ? weeklyElevationGain / course.elevationGain : 0
    if (relativeDPlus >= 2.0) {
      elevationCoverage = 0.8 // Si on fait 2x le D+ de la course par semaine, c'est très bien
    } else if (relativeDPlus >= 1.0) {
      elevationCoverage = 0.5 + (relativeDPlus - 1.0) * 0.3 // Entre 1x et 2x : progression
    } else {
      elevationCoverage = Math.max(0, relativeDPlus * 0.5) // En dessous de 1x : max 50%
    }
  }
  
  // 3. Score de sortie longue (relatif à la course)
  // Pour une course de X km, avoir fait au moins 40% de X en une sortie
  // Pour les petites courses (< 20km), avoir fait au moins 80% de la distance
  const longRunThreshold = course.distanceKm < 20 
    ? course.distanceKm * 0.8 // Pour les petites courses, viser 80%
    : Math.max(course.distanceKm * 0.4, 10) // Pour les grandes courses, 40% minimum, mais au moins 10km
  const idealLongRun = course.distanceKm < 20
    ? course.distanceKm * 1.0 // Pour les petites courses, idéalement avoir fait la distance complète
    : course.distanceKm * 0.6 // Pour les grandes courses, 60%
  let longRunCoverage = 0
  if (metrics.longRunDistanceKm >= idealLongRun) {
    longRunCoverage = 1.0
  } else if (metrics.longRunDistanceKm >= longRunThreshold) {
    longRunCoverage = 0.5 + (metrics.longRunDistanceKm - longRunThreshold) / (idealLongRun - longRunThreshold) * 0.5
  } else {
    // Pour les petites courses, si on a fait au moins 50% de la distance, c'est acceptable
    const relativeLongRun = course.distanceKm > 0 ? metrics.longRunDistanceKm / course.distanceKm : 0
    if (relativeLongRun >= 0.5) {
      longRunCoverage = 0.6 // Si on a fait au moins 50% de la distance, c'est bien
    } else {
      longRunCoverage = Math.max(0, relativeLongRun * 1.2) // Sinon, progression linéaire
    }
  }
  
  // 4. Score de D+ max en une sortie (relatif à la course)
  // Pour une course de X m D+, avoir fait au moins 50% de X en une sortie
  // Pour les petites courses (< 500m D+), avoir fait au moins 80% du D+
  const dPlusThreshold = course.elevationGain < 500
    ? course.elevationGain * 0.8 // Pour les petites courses, viser 80%
    : Math.max(course.elevationGain * 0.5, 200) // Pour les grandes courses, 50% minimum, mais au moins 200m
  const idealDPlusMax = course.elevationGain < 500
    ? course.elevationGain * 1.0 // Pour les petites courses, idéalement avoir fait le D+ complet
    : course.elevationGain * 0.7 // Pour les grandes courses, 70%
  let dPlusMaxCoverage = 0
  if (metrics.longRunDPlus >= idealDPlusMax) {
    dPlusMaxCoverage = 1.0
  } else if (metrics.longRunDPlus >= dPlusThreshold) {
    dPlusMaxCoverage = 0.5 + (metrics.longRunDPlus - dPlusThreshold) / (idealDPlusMax - dPlusThreshold) * 0.5
  } else {
    // Pour les petites courses, si on a fait au moins 50% du D+, c'est acceptable
    const relativeDPlusMax = course.elevationGain > 0 ? metrics.longRunDPlus / course.elevationGain : 0
    if (relativeDPlusMax >= 0.5) {
      dPlusMaxCoverage = 0.6 // Si on a fait au moins 50% du D+, c'est bien
    } else {
      dPlusMaxCoverage = Math.max(0, relativeDPlusMax * 1.2) // Sinon, progression linéaire
    }
  }
  
  // 5. Score de régularité (strict)
  const regularityScore = regularity === 'bonne' ? 1.0 : regularity === 'moyenne' ? 0.5 : 0.2 // Plus strict
  
  // Calcul du ratio global avec pondération stricte
  // Distance: 30%, D+: 30%, Sortie longue: 25%, D+ max: 10%, Régularité: 5%
  const coverageRatio = Math.round(
    (distanceCoverage * 0.30 +
      elevationCoverage * 0.30 +
      longRunCoverage * 0.25 +
      dPlusMaxCoverage * 0.10 +
      regularityScore * 0.05) *
      100
  )

  let summary = ''
  // Affiner le résumé avec les stats du Grand Raid si disponibles
  if (stats) {
    if (readiness === 'ready') {
      summary = `Ton niveau d'entraînement couvre ${coverageRatio}% des exigences. Avec ${stats.finisherRate}% de finishers en 2025, tu es sur la bonne voie si tu maintiens ta régularité.`
    } else if (readiness === 'needs_work') {
      summary = `À 6 mois de la course, ton volume couvre ${coverageRatio}% des exigences. Avec ${stats.abandonRate}% d'abandons en 2025, une montée progressive est nécessaire pour finir.`
    } else {
      summary = `Ton niveau actuel couvre ${coverageRatio}% des exigences. Avec ${stats.abandonRate}% d'abandons en 2025, un plan d'action immédiat est nécessaire pour éviter l'abandon.`
    }
  } else {
    if (readiness === 'ready') {
      summary = `Ton niveau d'entraînement actuel couvre environ ${coverageRatio}% des exigences de cette course. Tu es sur la bonne voie.`
    } else if (readiness === 'needs_work') {
      summary = `À 6 mois de la course, ton volume actuel couvre environ ${coverageRatio}% des exigences. C'est insuffisant mais rattrapable avec une montée progressive.`
    } else {
      summary = `Aujourd'hui, ton niveau d'entraînement couvre environ ${coverageRatio}% des exigences de cette course. Un plan d'action est nécessaire.`
    }
  }

  // === OBJECTIFS DES 4 PROCHAINES SEMAINES ===
  // Calculer des objectifs progressifs et cohérents (toujours min < max)
  const baseVolumeTarget = Math.round(courseWeeklyEquivalent * 0.5)
  const targetVolumeMin = Math.max(Math.round(weeklyDistanceKm * 1.15), baseVolumeTarget - 5)
  const targetVolumeMax = Math.max(targetVolumeMin + 5, Math.round(courseWeeklyEquivalent * 0.7))
  
  const baseDPlusTarget = Math.round(courseWeeklyDPlus * 0.5)
  const targetDPlusMin = Math.max(Math.round(weeklyElevationGain * 1.15), baseDPlusTarget - 100)
  const targetDPlusMax = Math.max(targetDPlusMin + 200, Math.round(courseWeeklyDPlus * 0.7))
  
  const targetFrequency = regularity === 'faible' ? 3 : regularity === 'moyenne' ? 4 : 4
  const targetLongRunHours = Math.max(2, Math.round((longRunThreshold / 8) * 10) / 10) // Estimation : 8 km/h en moyenne, minimum 2h

  // === CATÉGORISATION DES RECOMMANDATIONS ===
  const immediateActions: string[] = []
  const secondaryActions: string[] = []
  const testActions: string[] = []
  
  // Ajouter les actions critiques basées sur les stats en premier
  immediateActions.push(...tempImmediateActions)

  // Prioriser les recommandations critiques basées sur les stats
  recommendations.forEach((rec) => {
    // Les actions immédiates basées sur les stats sont déjà ajoutées plus haut
    if (rec.includes('Point d\'abandon') || rec.includes('Attention :')) {
      // Déjà dans immediateActions
      return
    } else if (rec.includes('fréquence') || rec.includes('régularité') || rec.includes('sorties longues progressives') || rec.includes('Volume hebdo faible') || rec.includes('D+ hebdo faible')) {
      immediateActions.push(rec)
    } else if (rec.includes('nutrition') || rec.includes('tester') || rec.includes('Tester')) {
      testActions.push(rec)
    } else {
      secondaryActions.push(rec)
    }
  })

  // Si pas assez d'actions immédiates, prendre les premières recommandations critiques
  if (immediateActions.length === 0 && recommendations.length > 0) {
    immediateActions.push(recommendations[0])
    if (recommendations.length > 1) {
      secondaryActions.push(...recommendations.slice(1))
    }
  }

  // === PROJECTION (SIMULATEUR F1) ===
  // Projection si continue ainsi (pas d'amélioration)
  const projectionIfContinues = {
    m3: readiness as 'ready' | 'needs_work' | 'risk', // Pas d'amélioration en 3 mois
    m1: readiness as 'ready' | 'needs_work' | 'risk', // Pas d'amélioration en 5 mois
  }

  // Projection si suit les objectifs (amélioration progressive)
  let projectionIfFollows: { m3: 'ready' | 'needs_work' | 'risk'; m1: 'ready' | 'needs_work' | 'risk' }
  if (readiness === 'risk') {
    // Si risque → peut passer à needs_work en 3 mois, et ready en 1 mois si pas trop de problèmes critiques
    projectionIfFollows = {
      m3: 'needs_work',
      m1: criticalIssues.length >= 3 ? 'needs_work' : 'ready',
    }
  } else if (readiness === 'needs_work') {
    // Si needs_work → peut passer à ready en 3 mois, et ready en 1 mois
    projectionIfFollows = {
      m3: 'ready',
      m1: 'ready',
    }
  } else {
    // Si ready → reste ready
    projectionIfFollows = {
      m3: 'ready',
      m1: 'ready',
    }
  }


  // === VERDICT DU COACH (phrases dynamiques) ===
  // Utiliser le coverageRatio déjà calculé plus haut (ligne 324)
  let coachVerdict: string | undefined
  if (metrics && timeEstimate) {
    // coverageRatio est déjà calculé ligne 324 avec la nouvelle logique
    
    // Utiliser les données réelles du Grand Raid si disponibles
    if (stats && stats.checkpoints && stats.checkpoints.length > 0) {
      const eliteTime = stats.checkpoints[stats.checkpoints.length - 1]?.times.elite || 23.5
      const averageTime = stats.checkpoints[stats.checkpoints.length - 1]?.times.average || 49.9
      const slowTime = stats.checkpoints[stats.checkpoints.length - 1]?.times.slow || 66.0
      
      // Identifier les segments critiques pour le coureur
      const criticalSegments = stats.checkpoints
        .filter((cp, i) => {
          if (i === 0) return false
          const prev = stats.checkpoints[i - 1]
          const speedDrop = cp.segmentSpeeds.elite > 0 
            ? ((cp.segmentSpeeds.elite - cp.segmentSpeeds.average) / cp.segmentSpeeds.elite) * 100 
            : 0
          return speedDrop > 40 && cp.segmentSpeeds.average < 5
        })
        .slice(0, 2)
      
      if (readiness === 'ready') {
        // Phrases positives avec données réelles
        if (timeEstimate.totalHours <= eliteTime * 1.15) {
          coachVerdict = `Ta base d'endurance est solide. Temps estimé : ${timeEstimate.rangeFormatted}. Tu es dans le top 10% des finishers 2025. Continue sur cette lancée.`
        } else if (timeEstimate.totalHours <= averageTime * 1.1) {
          coachVerdict = `Ta régularité est excellente. Temps estimé : ${timeEstimate.rangeFormatted}. Avec ${coverageRatio}% de couverture, tu as toutes les chances de finir dans le top 50%.`
        } else if (regularity === 'bonne') {
          coachVerdict = `Ta régularité est excellente. Avec ${coverageRatio}% de couverture, tu as toutes les chances de finir.`
        } else {
          coachVerdict = `Tu es sur la bonne voie. Maintiens ta régularité et tu finiras cette course.`
        }
      } else if (readiness === 'needs_work') {
        // Phrases d'alerte modérée avec segments critiques
        if (criticalSegments.length > 0) {
          const segment = criticalSegments[0]
          coachVerdict = `Attention au secteur "${segment.name}" (${segment.distanceKm} km) : les coureurs moyens ralentissent de ${Math.round((segment.segmentSpeeds.elite - segment.segmentSpeeds.average) / segment.segmentSpeeds.elite * 100)}% ici. Travaille spécifiquement ce passage.`
        } else if (metrics.longRunDistanceKm < course.distanceKm * 0.4) {
          coachVerdict = `Attention, tu manques de sorties longues. Ton simulateur prévoit une baisse de performance après ${Math.round(course.distanceKm * 0.6)} km.`
        } else if (regularity === 'faible') {
          coachVerdict = `Ta régularité est insuffisante. Augmente la fréquence à 3-4 sorties par semaine pour améliorer tes chances.`
        } else {
          coachVerdict = `À ${coverageRatio}% de couverture, tu peux finir mais avec effort. Temps estimé : ${timeEstimate.rangeFormatted}. Augmente progressivement ton volume.`
        }
      } else {
        // Phrases d'alerte forte avec données réelles
        if (timeEstimate.totalHours > slowTime) {
          coachVerdict = `Temps estimé : ${timeEstimate.rangeFormatted}. Attention, tu es en zone de risque d'abandon. ${stats.abandonRate}% des coureurs ont abandonné en 2025. Un plan d'action immédiat est nécessaire.`
        } else if (timeEstimate.totalHours > 20) {
          coachVerdict = `Temps estimé : ${timeEstimate.rangeFormatted}. Attention, tu manques de sorties longues de nuit. Les coureurs moyens ralentissent de 20-30% après 20h.`
        } else if (coverageRatio < 50) {
          coachVerdict = `Ton niveau actuel couvre seulement ${coverageRatio}% des exigences. Avec ${stats.abandonRate}% d'abandons en 2025, un plan d'action immédiat est nécessaire pour éviter l'abandon.`
        } else {
          coachVerdict = `À ${coverageRatio}% de couverture, tu es en zone de risque. Augmente rapidement ton volume et tes sorties longues.`
        }
      }
    } else {
      // Verdict sans stats Grand Raid (analyse générale)
      if (readiness === 'ready') {
        // Phrases positives
        if (coverageRatio >= 90) {
          coachVerdict = `Ta base d'endurance est solide pour finir dans le top 20%. Continue sur cette lancée.`
        } else if (regularity === 'bonne') {
          coachVerdict = `Ta régularité est excellente. Avec ${coverageRatio}% de couverture, tu as toutes les chances de finir.`
        } else {
          coachVerdict = `Tu es sur la bonne voie. Maintiens ta régularité et tu finiras cette course.`
        }
      } else if (readiness === 'needs_work') {
        // Phrases d'alerte modérée
        if (metrics.longRunDistanceKm < course.distanceKm * 0.4) {
          coachVerdict = `Attention, tu manques de sorties longues. Ton simulateur prévoit une baisse de performance après ${Math.round(course.distanceKm * 0.6)} km.`
        } else if (regularity === 'faible') {
          coachVerdict = `Ta régularité est insuffisante. Augmente la fréquence à 3-4 sorties par semaine pour améliorer tes chances.`
        } else {
          coachVerdict = `À ${coverageRatio}% de couverture, tu peux finir mais avec effort. Augmente progressivement ton volume.`
        }
      } else {
        // Phrases d'alerte forte
        if (timeEstimate.totalHours > 20) {
          coachVerdict = `Temps estimé : ${timeEstimate.rangeFormatted}. Attention, tu manques de sorties longues de nuit. Ton simulateur prévoit une baisse de 15% de ta vitesse après 22h.`
        } else if (coverageRatio < 50) {
          coachVerdict = `Ton niveau actuel couvre seulement ${coverageRatio}% des exigences. Un plan d'action immédiat est nécessaire pour éviter l'abandon.`
        } else {
          coachVerdict = `À ${coverageRatio}% de couverture, tu es en zone de risque. Augmente rapidement ton volume et tes sorties longues.`
        }
      }
    }
  }

  return {
    readiness,
    readinessLabel,
    recommendations: [...new Set(recommendations)], // Supprimer les doublons
    issues,
    strengths,
    regularity,
    regularityDetails,
    summary,
    immediateActions: [...new Set(immediateActions)],
    secondaryActions: [...new Set(secondaryActions)],
    testActions: [...new Set(testActions)],
    next4WeeksGoals: {
      volumeKm: {
        min: Math.round(targetVolumeMin),
        max: Math.round(targetVolumeMax),
      },
      dPlus: {
        min: Math.round(targetDPlusMin),
        max: Math.round(targetDPlusMax),
      },
      frequency: targetFrequency,
      longRunHours: Math.round(targetLongRunHours * 10) / 10,
    },
    projection: {
      ifContinues: projectionIfContinues,
      ifFollowsGoals: projectionIfFollows,
    },
    timeEstimate,
    coachVerdict,
  }
}
