import type { StravaMetrics, StravaSegment } from '../types/strava'

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
}

/**
 * Analyse la préparation du coureur pour une course donnée
 * Compare les métriques Strava avec les exigences de la course
 */
export function analyzeCourseReadiness(
  metrics: StravaMetrics | null,
  course: CourseData,
  segments?: StravaSegment[]
): CourseAnalysis {
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
    }
  }

  const issues: string[] = []
  const strengths: string[] = []
  const recommendations: string[] = []

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
  const longRunThreshold = course.distanceKm * 0.4 // 40% de la distance de course
  if (metrics.longRunDistanceKm < longRunThreshold) {
    issues.push(`Sortie longue max (${metrics.longRunDistanceKm} km) < 40% de la course (${Math.round(longRunThreshold)} km)`)
    recommendations.push(`Planifier des sorties longues progressives : objectif ${Math.round(longRunThreshold)} km`)
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
  const coverageRatio = Math.min(
    100,
    Math.round(
      ((weeklyDistanceKm / courseWeeklyEquivalent) * 0.4 +
        (weeklyElevationGain / courseWeeklyDPlus) * 0.4 +
        (regularity === 'bonne' ? 1 : regularity === 'moyenne' ? 0.5 : 0) * 20) *
        100
    )
  )

  let summary = ''
  if (readiness === 'ready') {
    summary = `Ton niveau d'entraînement actuel couvre environ ${coverageRatio}% des exigences de cette course. Tu es sur la bonne voie.`
  } else if (readiness === 'needs_work') {
    summary = `À 6 mois de la course, ton volume actuel est insuffisant mais rattrapable avec une montée progressive.`
  } else {
    summary = `Aujourd'hui, ton niveau d'entraînement couvre environ ${coverageRatio}% des exigences de cette course. Un plan d'action est nécessaire.`
  }

  // === OBJECTIFS DES 4 PROCHAINES SEMAINES ===
  const targetVolumeMin = Math.max(weeklyDistanceKm * 1.1, courseWeeklyEquivalent * 0.5)
  const targetVolumeMax = Math.min(courseWeeklyEquivalent * 0.8, weeklyDistanceKm * 1.5)
  const targetDPlusMin = Math.max(weeklyElevationGain * 1.1, courseWeeklyDPlus * 0.5)
  const targetDPlusMax = Math.min(courseWeeklyDPlus * 0.8, weeklyElevationGain * 1.5)
  const targetFrequency = regularity === 'faible' ? 3 : regularity === 'moyenne' ? 4 : 4
  const targetLongRunHours = longRunThreshold / 8 // Estimation : 8 km/h en moyenne

  // === CATÉGORISATION DES RECOMMANDATIONS ===
  const immediateActions: string[] = []
  const secondaryActions: string[] = []
  const testActions: string[] = []

  recommendations.forEach((rec) => {
    if (rec.includes('fréquence') || rec.includes('régularité') || rec.includes('sorties longues progressives')) {
      immediateActions.push(rec)
    } else if (rec.includes('nutrition') || rec.includes('tester')) {
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
    // Si risque → peut passer à needs_work en 3 mois, et ready ou needs_work en 1 mois
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
  }
}
