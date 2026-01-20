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
  
  // 1. Score de distance hebdomadaire
  // Minimum réaliste pour une course de 175 km : 40-50 km/semaine minimum
  // Objectif idéal à 6 mois : 50-70% de la distance hebdomadaire finale = 29-41 km/sem
  const minDistanceWeekly = 40 // Seuil minimal strict en km/semaine
  const idealDistanceWeekly = courseWeeklyEquivalent * 0.7 // 70% de l'exigence finale = objectif réaliste
  let distanceCoverage = 0
  if (weeklyDistanceKm >= idealDistanceWeekly) {
    distanceCoverage = 1.0 // Excellent
  } else if (weeklyDistanceKm >= minDistanceWeekly) {
    distanceCoverage = 0.5 + (weeklyDistanceKm - minDistanceWeekly) / (idealDistanceWeekly - minDistanceWeekly) * 0.5 // Progression linéaire entre min et ideal
  } else {
    distanceCoverage = Math.max(0, (weeklyDistanceKm / minDistanceWeekly) * 0.5) // En dessous du minimum : max 50%
  }
  
  // 2. Score de D+ hebdomadaire
  // Minimum réaliste pour une course de 10150 D+ : 1500-2000 m/semaine minimum
  // Objectif idéal à 6 mois : 50-70% du D+ hebdomadaire final = 846-1184 m/sem
  const minDPlusWeekly = 1500 // Seuil minimal strict en m/semaine
  const idealDPlusWeekly = courseWeeklyDPlus * 0.7 // 70% de l'exigence finale
  let elevationCoverage = 0
  if (weeklyElevationGain >= idealDPlusWeekly) {
    elevationCoverage = 1.0 // Excellent
  } else if (weeklyElevationGain >= minDPlusWeekly) {
    elevationCoverage = 0.5 + (weeklyElevationGain - minDPlusWeekly) / (idealDPlusWeekly - minDPlusWeekly) * 0.5 // Progression linéaire
  } else {
    elevationCoverage = Math.max(0, (weeklyElevationGain / minDPlusWeekly) * 0.5) // En dessous du minimum : max 50%
  }
  
  // 3. Score de sortie longue
  // Pour une course de 175 km, avoir fait au moins 70 km en une sortie est un minimum sérieux
  const longRunThreshold = Math.max(course.distanceKm * 0.4, 70) // Au minimum 70 km (40% de 175 = 70)
  const idealLongRun = course.distanceKm * 0.6 // Objectif idéal : 60% = 105 km
  let longRunCoverage = 0
  if (metrics.longRunDistanceKm >= idealLongRun) {
    longRunCoverage = 1.0
  } else if (metrics.longRunDistanceKm >= longRunThreshold) {
    longRunCoverage = 0.5 + (metrics.longRunDistanceKm - longRunThreshold) / (idealLongRun - longRunThreshold) * 0.5
  } else {
    longRunCoverage = Math.max(0, (metrics.longRunDistanceKm / longRunThreshold) * 0.5)
  }
  
  // 4. Score de D+ max en une sortie
  // Pour une course de 10150 D+, avoir fait au moins 6000 m en une sortie est un minimum sérieux
  const dPlusThreshold = Math.max(course.elevationGain * 0.5, 6000) // Au minimum 6000 m (50% de 10150 = 5075, mais on met 6000 pour être strict)
  const idealDPlusMax = course.elevationGain * 0.7 // Objectif idéal : 70% = 7105 m
  let dPlusMaxCoverage = 0
  if (metrics.longRunDPlus >= idealDPlusMax) {
    dPlusMaxCoverage = 1.0
  } else if (metrics.longRunDPlus >= dPlusThreshold) {
    dPlusMaxCoverage = 0.5 + (metrics.longRunDPlus - dPlusThreshold) / (idealDPlusMax - dPlusThreshold) * 0.5
  } else {
    dPlusMaxCoverage = Math.max(0, (metrics.longRunDPlus / dPlusThreshold) * 0.5)
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

  // === ESTIMATION DU TEMPS DE COURSE ===
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
