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
  /** Température en °C (optionnel, ex. depuis API météo) */
  temperature?: number
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
  const tempImmediateActions: string[] = []

  const isShortCourse = course.distanceKm < 20
  const isVeryShortCourse = course.distanceKm <= 12 && course.elevationGain < 600

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

  // === ANALYSE DÉNIVELÉ (pour courses courtes avec peu de D+, ne pas être excessif) ===
  const dPlusGap = course.elevationGain - metrics.longRunDPlus
  const dPlusThresholdShort = course.elevationGain * 0.6
  if (course.elevationGain > 0 && metrics.longRunDPlus < course.elevationGain) {
    if (isVeryShortCourse && metrics.longRunDPlus >= dPlusThresholdShort) {
      recommendations.push(`Ajouter un peu de dénivelé : objectif ${Math.round(course.elevationGain * 0.8)} m D+ sur une sortie pour être à l'aise`)
    } else if (!isVeryShortCourse || dPlusGap > course.elevationGain * 0.5) {
      issues.push(`D+ course (${Math.round(course.elevationGain)} m) > D+ max entraîné (${Math.round(metrics.longRunDPlus)} m)`)
      recommendations.push(`Augmenter le travail en montée : objectif ${Math.round(course.elevationGain * 0.8)} m D+ sur une sortie`)
    } else {
      recommendations.push(`Augmenter le travail en montée : objectif ${Math.round(course.elevationGain * 0.8)} m D+ sur une sortie`)
    }
  } else if (course.elevationGain > 0) {
    strengths.push(`D+ max entraîné (${Math.round(metrics.longRunDPlus)} m) couvre la course (${Math.round(course.elevationGain)} m)`)
  }

  // === ANALYSE VOLUME HEBDOMADAIRE (seuils proportionnés à la course) ===
  const weeklyDistanceKm = metrics.kmPerWeek
  const weeklyElevationGain = metrics.dPlusPerWeek
  const courseWeeklyEquivalent = course.distanceKm / 6
  // Pour les courses courtes : objectif réaliste (ex. 9 km → 5–9 km/sem suffisant)
  const minWeeklyKm = isShortCourse
    ? Math.max(2, course.distanceKm * 0.4)
    : courseWeeklyEquivalent * 0.5
  const targetWeeklyKm = isShortCourse
    ? Math.max(minWeeklyKm, Math.min(course.distanceKm * 1.2, 15))
    : Math.max(courseWeeklyEquivalent * 0.7, 15)

  if (weeklyDistanceKm < minWeeklyKm) {
    issues.push(`Volume hebdo faible (${weeklyDistanceKm} km/sem) vs objectif (~${Math.round(targetWeeklyKm)} km/sem)`)
    recommendations.push(`Augmenter le volume progressivement : objectif ${Math.round(targetWeeklyKm)} km/semaine`)
  } else if (weeklyDistanceKm < targetWeeklyKm * 0.8) {
    recommendations.push(`Continuer à augmenter le volume : viser ${Math.round(targetWeeklyKm)} km/semaine`)
  } else {
    strengths.push(`Volume hebdomadaire solide (${weeklyDistanceKm} km/semaine)`)
  }

  // === ANALYSE DÉNIVELÉ HEBDOMADAIRE (proportionné au D+ de la course) ===
  const courseWeeklyDPlus = course.elevationGain / 6
  const minWeeklyDPlus = isShortCourse && course.elevationGain < 500
    ? Math.max(0, course.elevationGain * 0.2)
    : Math.max(course.elevationGain * 0.15, 100)
  const targetWeeklyDPlus = isShortCourse && course.elevationGain < 500
    ? Math.max(minWeeklyDPlus, course.elevationGain * 0.5)
    : Math.max(courseWeeklyDPlus * 0.7, 200)

  if (course.elevationGain > 50 && weeklyElevationGain < minWeeklyDPlus) {
    issues.push(`D+ hebdo faible (${Math.round(weeklyElevationGain)} m/sem) vs objectif (~${Math.round(targetWeeklyDPlus)} m/sem)`)
    recommendations.push(`Augmenter le D+ hebdomadaire : objectif ${Math.round(targetWeeklyDPlus)} m/semaine`)
  } else if (course.elevationGain > 50 && weeklyElevationGain < targetWeeklyDPlus * 0.8) {
    recommendations.push(`Continuer à augmenter le D+ : viser ${Math.round(targetWeeklyDPlus)} m/semaine`)
  } else if (course.elevationGain > 50) {
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

  // === ANALYSE SORTIES LONGUES (seuil proportionné : court = 70%, long = 40%) ===
  const longRunThresholdMin = isShortCourse ? course.distanceKm * 0.7 : Math.max(course.distanceKm * 0.4, 10)
  if (metrics.longRunDistanceKm < longRunThresholdMin) {
    issues.push(`Sortie longue max (${metrics.longRunDistanceKm} km) < objectif (${Math.round(longRunThresholdMin)} km pour ${course.distanceKm} km)`)
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

  // === RECOMMANDATIONS GÉNÉRALES (adaptées à la longueur de la course) ===
  const longRunCoversCourse = metrics.longRunDistanceKm >= course.distanceKm * 1.05
  if (!isShortCourse && metrics.longRunDistanceKm < 20) {
    recommendations.push('Ajouter 2 sorties > 4h dans les prochaines semaines')
  }
  if (weeklyElevationGain < 2000 && course.elevationGain > 500) {
    recommendations.push('Augmenter le travail en descente et en terrain technique')
  }
  if (course.distanceKm >= 15) {
    recommendations.push('Tester la nutrition sur effort long (>3h)')
  }

  // === DÉTERMINATION DU STATUT ===
  let readiness: 'ready' | 'needs_work' | 'risk'
  let readinessLabel: 'Prêt' | 'À renforcer' | 'Risque'

  const criticalIssues = issues.filter((issue) => {
    if (issue.includes('> 120%') || issue.includes('Régularité faible')) return true
    if (issue.includes('> D+ max') || issue.includes('D+ course')) {
      if (isVeryShortCourse) return false
      return true
    }
    if (issue.includes('Volume hebdo faible')) {
      if (isShortCourse && weeklyDistanceKm >= course.distanceKm) return false
      return true
    }
    return false
  })

  const dPlusCoversCourse = course.elevationGain <= metrics.longRunDPlus * 1.1
  const dPlusPartiallyCovered = course.elevationGain > 0 && metrics.longRunDPlus >= course.elevationGain * 0.4

  if (isShortCourse && longRunCoversCourse && (dPlusCoversCourse || (isVeryShortCourse && dPlusPartiallyCovered)) && criticalIssues.length < 2) {
    if (criticalIssues.length >= 1) {
      readiness = 'needs_work'
      readinessLabel = 'À renforcer'
    } else if (issues.length > 0 || recommendations.length > 3) {
      readiness = 'needs_work'
      readinessLabel = 'À renforcer'
    } else {
      readiness = 'ready'
      readinessLabel = 'Prêt'
    }
  } else if (isVeryShortCourse && longRunCoversCourse && criticalIssues.length <= 1) {
    readiness = dPlusCoversCourse || dPlusPartiallyCovered ? 'ready' : 'needs_work'
    readinessLabel = readiness === 'ready' ? 'Prêt' : 'À renforcer'
  } else if (criticalIssues.length >= 2) {
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
  
  // 1. Score de distance hebdomadaire (relatif à la course, précis pour court/long)
  const minDistanceWeekly = isShortCourse
    ? Math.max(2, course.distanceKm * 0.4)
    : Math.max(course.distanceKm * 0.2, Math.min(15, course.distanceKm * 1.5))
  const idealDistanceWeekly = isShortCourse
    ? Math.max(minDistanceWeekly, course.distanceKm * 0.8)
    : courseWeeklyEquivalent * 0.7
  let distanceCoverage = 0
  if (weeklyDistanceKm >= idealDistanceWeekly) {
    distanceCoverage = 1.0
  } else if (weeklyDistanceKm >= minDistanceWeekly && idealDistanceWeekly > minDistanceWeekly) {
    distanceCoverage = 0.5 + ((weeklyDistanceKm - minDistanceWeekly) / (idealDistanceWeekly - minDistanceWeekly)) * 0.5
  } else {
    const relativeDistance = course.distanceKm > 0 ? weeklyDistanceKm / course.distanceKm : 0
    if (relativeDistance >= 1.2) distanceCoverage = 0.85
    else if (relativeDistance >= 1.0) distanceCoverage = 0.7
    else if (relativeDistance >= 0.6) distanceCoverage = 0.4 + (relativeDistance - 0.6) * 0.75
    else distanceCoverage = Math.max(0, relativeDistance * 0.65)
  }

  // 2. Score de D+ hebdomadaire (relatif à la course)
  const minDPlusWeekly = isShortCourse && course.elevationGain < 500
    ? Math.max(0, course.elevationGain * 0.2)
    : Math.max(course.elevationGain * 0.15, Math.min(300, course.elevationGain * 0.8))
  const idealDPlusWeekly = isShortCourse && course.elevationGain < 500
    ? Math.max(minDPlusWeekly, course.elevationGain * 0.5)
    : courseWeeklyDPlus * 0.7
  let elevationCoverage = 0
  if (course.elevationGain <= 0) {
    elevationCoverage = 1.0
  } else if (weeklyElevationGain >= idealDPlusWeekly) {
    elevationCoverage = 1.0
  } else if (weeklyElevationGain >= minDPlusWeekly && idealDPlusWeekly > minDPlusWeekly) {
    elevationCoverage = 0.5 + ((weeklyElevationGain - minDPlusWeekly) / (idealDPlusWeekly - minDPlusWeekly)) * 0.5
  } else {
    const relativeDPlus = weeklyElevationGain / course.elevationGain
    if (relativeDPlus >= 0.8) elevationCoverage = 0.75
    else if (relativeDPlus >= 0.5) elevationCoverage = 0.5 + (relativeDPlus - 0.5) * 0.5
    else elevationCoverage = Math.max(0, relativeDPlus * 1.0)
  }
  
  // 3. Score de sortie longue (relatif à la course)
  const longRunThreshold = isShortCourse ? course.distanceKm * 0.7 : Math.max(course.distanceKm * 0.4, 10)
  const idealLongRun = isShortCourse ? course.distanceKm : course.distanceKm * 0.6
  let longRunCoverage = 0
  if (metrics.longRunDistanceKm >= idealLongRun) {
    longRunCoverage = 1.0
  } else if (metrics.longRunDistanceKm >= longRunThreshold && idealLongRun > longRunThreshold) {
    longRunCoverage = 0.5 + ((metrics.longRunDistanceKm - longRunThreshold) / (idealLongRun - longRunThreshold)) * 0.5
  } else {
    const relativeLongRun = course.distanceKm > 0 ? metrics.longRunDistanceKm / course.distanceKm : 0
    longRunCoverage = relativeLongRun >= 0.5 ? 0.55 + (relativeLongRun - 0.5) * 0.9 : Math.max(0, relativeLongRun * 1.1)
  }

  // 4. Score de D+ max en une sortie (relatif à la course)
  const dPlusThreshold = course.elevationGain < 500
    ? course.elevationGain * 0.5
    : Math.max(course.elevationGain * 0.5, 200)
  const idealDPlusMax = course.elevationGain < 500 ? course.elevationGain : course.elevationGain * 0.7
  let dPlusMaxCoverage = 0
  if (course.elevationGain <= 0) {
    dPlusMaxCoverage = 1.0
  } else if (metrics.longRunDPlus >= idealDPlusMax) {
    dPlusMaxCoverage = 1.0
  } else if (metrics.longRunDPlus >= dPlusThreshold && idealDPlusMax > dPlusThreshold) {
    dPlusMaxCoverage = 0.5 + ((metrics.longRunDPlus - dPlusThreshold) / (idealDPlusMax - dPlusThreshold)) * 0.5
  } else {
    const relativeDPlusMax = metrics.longRunDPlus / course.elevationGain
    dPlusMaxCoverage = relativeDPlusMax >= 0.4 ? 0.5 + (relativeDPlusMax - 0.4) * 0.83 : Math.max(0, relativeDPlusMax * 1.25)
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
      summary = `Ton niveau d'entraînement couvre environ ${coverageRatio}% des exigences de cette course. Tu es sur la bonne voie.`
    } else if (readiness === 'needs_work') {
      summary = isVeryShortCourse
        ? `Ton volume couvre environ ${coverageRatio}% des exigences. Quelques ajustements (dénivelé, régularité) te mettront à l'aise.`
        : `Ton volume actuel couvre environ ${coverageRatio}% des exigences. C'est rattrapable avec une montée progressive.`
    } else {
      summary = isVeryShortCourse && longRunCoversCourse
        ? `Tu as la distance pour cette course. Travaille le dénivelé et la régularité pour être prêt.`
        : `Ton niveau couvre environ ${coverageRatio}% des exigences. Un plan d'action est nécessaire.`
    }
  }

  // === OBJECTIFS DES 4 PROCHAINES SEMAINES (proportionnés à la course) ===
  const baseVolumeTarget = isShortCourse
    ? Math.max(3, Math.round(course.distanceKm * 0.6))
    : Math.round(courseWeeklyEquivalent * 0.5)
  const targetVolumeMin = Math.max(
    Math.round(weeklyDistanceKm * 1.1),
    baseVolumeTarget,
    isShortCourse ? Math.round(course.distanceKm * 0.5) : 10
  )
  const targetVolumeMax = Math.max(
    targetVolumeMin + (isShortCourse ? 3 : 5),
    isShortCourse ? Math.round(course.distanceKm * 1.2) : Math.round(courseWeeklyEquivalent * 0.7)
  )

  const baseDPlusTarget = course.elevationGain > 0
    ? (isShortCourse && course.elevationGain < 500
        ? Math.round(course.elevationGain * 0.3)
        : Math.round(courseWeeklyDPlus * 0.5))
    : 0
  const targetDPlusMin = Math.max(Math.round(weeklyElevationGain * 1.1), baseDPlusTarget, 0)
  const targetDPlusMax = Math.max(
    targetDPlusMin + (course.elevationGain < 500 ? 50 : 150),
    course.elevationGain > 0 ? Math.round((isShortCourse ? course.elevationGain * 0.5 : courseWeeklyDPlus * 0.7)) : 0
  )

  const targetFrequency = regularity === 'faible' ? 3 : regularity === 'moyenne' ? 4 : 4
  const targetLongRunHours = isShortCourse
    ? Math.max(0.5, Math.round((course.distanceKm / 8) * 10) / 10)
    : Math.max(2, Math.round((longRunThreshold / 8) * 10) / 10)

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

  // === ESTIMATION DU TEMPS DE COURSE ===
  let timeEstimate: TimeEstimate | undefined
  try {
    timeEstimate = estimateTrailTime(
      {
        distanceKm: course.distanceKm,
        elevationGain: course.elevationGain,
        temperature: course.temperature ?? 15,
        bagWeight: 2, // Poids du sac par défaut : 2 kg
        refuelStops: Math.ceil(course.distanceKm / 20), // 1 ravitaillement tous les 20 km
        refuelTimePerStop: 2,
      },
      metrics
    )

    // Ajouter une recommandation basée sur le temps estimé si très long
    if (timeEstimate.totalHours > 20) {
      recommendations.push(
        `Temps estimé : ${timeEstimate.rangeFormatted}. Prévoyez une stratégie de gestion de l'effort sur la durée.`
      )
    } else if (timeEstimate.totalHours > 12) {
      recommendations.push(
        `Temps estimé : ${timeEstimate.rangeFormatted}. Travaillez votre endurance fondamentale pour tenir la distance.`
      )
    }
  } catch (error) {
    console.warn('Erreur lors de l\'estimation du temps de course:', error)
    timeEstimate = undefined
  }

  // === VERDICT DU COACH (phrases dynamiques) ===
  // Utiliser le coverageRatio déjà calculé plus haut (ligne 324)
  let coachVerdict: string | undefined
  if (metrics && timeEstimate) {
    // coverageRatio est déjà calculé ligne 324 avec la nouvelle logique
    
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
      if (isVeryShortCourse && longRunCoversCourse) {
        coachVerdict = `Tu as la distance pour cette course courte. Ajoute un peu de dénivelé à l'entraînement pour être à l'aise le jour J.`
      } else if (timeEstimate.totalHours > 20) {
        coachVerdict = `Temps estimé : ${timeEstimate.rangeFormatted}. Attention, tu manques de sorties longues de nuit. Ton simulateur prévoit une baisse de 15% de ta vitesse après 22h.`
      } else if (coverageRatio < 50 && !isVeryShortCourse) {
        coachVerdict = `Ton niveau actuel couvre seulement ${coverageRatio}% des exigences. Un plan d'action immédiat est nécessaire pour éviter l'abandon.`
      } else if (coverageRatio < 50) {
        coachVerdict = `Ton niveau couvre environ ${coverageRatio}% des exigences. Augmente progressivement volume et dénivelé pour être prêt.`
      } else {
        coachVerdict = `À ${coverageRatio}% de couverture, tu es en zone de risque. Augmente rapidement ton volume et tes sorties longues.`
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
        min: Math.max(1, Math.round(targetVolumeMin)),
        max: Math.max(Math.round(targetVolumeMin) + 1, Math.round(targetVolumeMax)),
      },
      dPlus: {
        min: Math.max(0, Math.round(targetDPlusMin)),
        max: Math.max(Math.round(targetDPlusMin), Math.round(targetDPlusMax)),
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
