import './SingleCoursePage.css'

import { FiAlertCircle, FiZap } from 'react-icons/fi'
import gpxIcon from '../assets/d824ad10b22406bc6f779da5180da5cdaeca1e2c.svg'
import HeaderTopBar from '../components/HeaderTopBar'
import SideNav from '../components/SideNav'
import SingleCourseElevationChart from '../components/SingleCourseElevationChart'
import SimulationEngine from '../components/SimulationEngine'
import PhysioGauge from '../components/PhysioGauge'
import TerrainComparison from '../components/TerrainComparison'
import RaceStrategy from '../components/RaceStrategy'
import { useEffect, useState } from 'react'
import useGpxHoverMarker from '../hooks/useGpxHoverMarker'
import useStravaMetrics from '../hooks/useStravaMetrics'
import { analyzeCourseReadiness } from '../lib/courseAnalysis'
import { grandRaidStats } from '../data/grandRaidStats'
import { calculateTSBFromMetrics } from '../lib/tsbCalculator'
import { calculateElevationStats, analyzeProfileZones } from '../lib/profileAnalysis'
import { segmentSvgWithZones, addSvgTooltips } from '../lib/svgZoneSegmenter'

type SingleCoursePageProps = {
  onNavigate?: (view: 'saison' | 'events' | 'courses' | 'course' | 'account') => void
  events: Array<{
    id: string
    name: string
    country: string
    startLabel: string
    imageUrl?: string
    courses: Array<{
      id: string
      name: string
      imageUrl?: string
      gpxName?: string
      gpxSvg?: string
      distanceKm?: number
      elevationGain?: number
    }>
  }>
  selectedCourseId: string | null
}

export default function SingleCoursePage({
  onNavigate,
  events,
  selectedCourseId,
}: SingleCoursePageProps) {
  const selectedCourse =
    events
      .flatMap((event) => event.courses.map((course) => ({ ...course, eventName: event.name })))
      .find((course) => course.id === selectedCourseId) ?? events[0]?.courses[0]

  const courseTitle = selectedCourse?.name ?? 'Course'
  const courseEventName = (selectedCourse as { eventName?: string } | undefined)?.eventName ?? 'Grand Raid'
  const courseStats =
    selectedCourse?.distanceKm && selectedCourse?.elevationGain
      ? `${selectedCourse.distanceKm.toFixed(0)} km · ${Math.round(selectedCourse.elevationGain)} D+`
      : '175 km · 10 150 D+ · Août 2026'
  const courseHeading = `${courseEventName.toUpperCase()} – ${courseTitle}`
  const coursePrep = 'Préparation en cours : M-6'
  const rawProfile = (selectedCourse as { profile?: Array<[number, number]> | string } | undefined)?.profile
  // Parser le profile si c'est une string JSON, sinon utiliser directement
  let profileData: Array<[number, number]> | undefined = undefined
  if (rawProfile) {
    if (typeof rawProfile === 'string') {
      try {
        // Le profile peut être une string JSON double-encodée
        const parsed = JSON.parse(rawProfile)
        if (typeof parsed === 'string') {
          profileData = JSON.parse(parsed)
        } else if (Array.isArray(parsed)) {
          profileData = parsed
        }
      } catch {
        profileData = undefined
      }
    } else if (Array.isArray(rawProfile) && rawProfile.length > 0) {
      profileData = rawProfile
    }
  }
  const gpxSvg = selectedCourse?.gpxSvg
  const maxDistance = profileData?.length ? profileData[profileData.length - 1][0] : undefined
  useGpxHoverMarker('gpx-inline-svg', maxDistance)
  const { metrics } = useStravaMetrics()
  const [segmentedSvg, setSegmentedSvg] = useState<string | null>(null)

  // Analyser la préparation pour cette course
  const courseData = selectedCourse?.distanceKm && selectedCourse?.elevationGain
    ? {
        distanceKm: selectedCourse.distanceKm,
        elevationGain: selectedCourse.elevationGain,
        name: selectedCourse.name,
      }
    : {
        distanceKm: 175,
        elevationGain: 10150,
        name: 'Grand Raid',
      }

  // Récupérer les segments Strava de la course
  const stravaSegments = (selectedCourse as { stravaSegments?: Array<{
    id: number
    name: string
    distance: number
    elevation_gain: number
    average_grade: number
    type: 'climb' | 'descent' | 'flat'
  }> } | undefined)?.stravaSegments

  // Utiliser les stats du Grand Raid si c'est une course similaire
  const useGrandRaidStats = courseData.name?.toLowerCase().includes('grand raid') || 
                            courseData.name?.toLowerCase().includes('diagonale') ||
                            (courseData.distanceKm > 150 && courseData.elevationGain > 8000)
  
  const analysis = analyzeCourseReadiness(
    metrics, 
    courseData, 
    stravaSegments,
    useGrandRaidStats ? grandRaidStats : undefined
  )

  // Calculer le TSB réel
  const tsb = calculateTSBFromMetrics(metrics)

  // Calculer les stats d'élévation depuis le profil
  const elevationStats = profileData ? calculateElevationStats(profileData) : {
    elevationGain: courseData.elevationGain,
    elevationLoss: 0,
  }

  // Analyser les zones du profil
  const profileZones = profileData && metrics
    ? analyzeProfileZones(profileData, metrics, courseData.distanceKm, courseData.elevationGain)
    : []

  // Segmenter le SVG avec les zones
  useEffect(() => {
    let cleanupTooltips: (() => void) | undefined

    if (gpxSvg && profileZones.length > 0 && profileData) {
      const segmented = segmentSvgWithZones(gpxSvg, profileZones, profileData)
      setSegmentedSvg(segmented)
      
      // Ajouter les tooltips après un court délai pour que le SVG soit rendu
      const timer = setTimeout(() => {
        cleanupTooltips = addSvgTooltips('gpx-inline-svg')
      }, 200)
      
      return () => {
        clearTimeout(timer)
        if (cleanupTooltips) {
          cleanupTooltips()
        }
      }
    } else {
      setSegmentedSvg(gpxSvg || null)
    }
  }, [gpxSvg, profileZones, profileData])
  return (
    <div className="single-course-page">
      <HeaderTopBar onNavigate={onNavigate} />

      <div className="single-course-body">
        <aside className="single-course-side">
          <SideNav activeItem="saison" onNavigate={onNavigate} />
        </aside>

        <main className="single-course-main">
          <section className="single-course-heading">
            <div>
              <p className="single-course-title">COURSE</p>
            </div>
          </section>

          <section className="single-course-content">
            <div className="single-course-course">
              <div className="single-course-course__meta">
                <p className="single-course-course__meta-title">{courseHeading}</p>
                <p className="single-course-course__meta-stats">{courseStats}</p>
                <p className="single-course-course__meta-prep">{coursePrep}</p>
              </div>
              <div className="single-course-course__gpx">
                {segmentedSvg || gpxSvg ? (
                  <div
                    className="single-course-course__gpx-svg"
                    dangerouslySetInnerHTML={{ __html: (segmentedSvg || gpxSvg || '').replace('<svg', '<svg id=\"gpx-inline-svg\"') }}
                  />
                ) : (
                  <img src={gpxIcon} alt="GPX" />
                )}
              </div>
              <div className="single-course-course__card">
                <SingleCourseElevationChart data={profileData} metrics={metrics} />
              </div>
            </div>

            {/* Blocs fonctionnels : PhysioGauge, TerrainComparison, RaceStrategy */}
            <div className="single-course-charts-grid">
              <div className="single-course-chart-block">
                <PhysioGauge tsb={tsb} />
              </div>
              <div className="single-course-chart-block">
                <TerrainComparison
                  elevationGain={{
                    current: metrics?.longRunDPlus || 0,
                    target: courseData.elevationGain,
                  }}
                  elevationLoss={{
                    current: elevationStats.elevationLoss,
                    target: elevationStats.elevationLoss,
                  }}
                />
              </div>
              <div className="single-course-chart-block">
                <RaceStrategy profileData={profileData} />
              </div>
            </div>

            <div className="single-course-panel">
              <div className="single-course-panel__header">
                <p>CHARGE & RÉGULARITÉ (6 semaines)</p>
                <div className="single-course-panel__value">
                  <span>{metrics ? metrics.loadScore.toLocaleString('fr-FR') : '...'}</span>
                  <span className="single-course-panel__delta">
                    {metrics ? `${metrics.loadDelta > 0 ? '+' : ''}${metrics.loadDelta}%` : '...'}
                  </span>
                </div>
              </div>
              <div className="single-course-panel__cards">
                <div className="single-course-panel__card">
                  <p className="single-course-panel__title">ÉTAT DE PRÉPARATION</p>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      marginTop: '12px',
                      padding: '12px',
                      borderRadius: '8px',
                      background:
                        analysis.readiness === 'ready'
                          ? 'rgba(34, 197, 94, 0.1)'
                          : analysis.readiness === 'needs_work'
                            ? 'rgba(251, 191, 36, 0.1)'
                            : 'rgba(239, 68, 68, 0.1)',
                      border: `1px solid ${
                        analysis.readiness === 'ready'
                          ? 'rgba(34, 197, 94, 0.3)'
                          : analysis.readiness === 'needs_work'
                            ? 'rgba(251, 191, 36, 0.3)'
                            : 'rgba(239, 68, 68, 0.3)'
                      }`,
                    }}
                  >
                    <span
                      style={{
                        fontSize: '32px',
                        fontWeight: 'bold',
                        color:
                          analysis.readiness === 'ready'
                            ? '#22c55e'
                            : analysis.readiness === 'needs_work'
                              ? '#fbbf24'
                              : '#ef4444',
                      }}
                    >
                      {analysis.readiness === 'ready' ? '🟢' : analysis.readiness === 'needs_work' ? '🟠' : '🔴'}
                    </span>
                    <div>
                      <p style={{ margin: 0, fontSize: '18px', fontWeight: 600 }}>{analysis.readinessLabel}</p>
                      <p style={{ margin: '4px 0 0', fontSize: '12px', opacity: 0.8 }}>
                        {analysis.readiness === 'ready'
                          ? 'Vous êtes prêt pour cette course'
                          : analysis.readiness === 'needs_work'
                            ? 'Quelques ajustements nécessaires'
                            : 'Attention : préparation insuffisante'}
                      </p>
                    </div>
                  </div>
                  {/* Résumé en 1 phrase */}
                  {analysis.summary && (
                    <p style={{ marginTop: '16px', fontSize: '14px', lineHeight: '1.5', color: 'var(--color-text-primary, #e5e7eb)' }}>
                      {analysis.summary}
                    </p>
                  )}
                  {/* Verdict du Coach */}
                  {analysis.coachVerdict && (
                    <div
                      style={{
                        marginTop: '16px',
                        padding: '12px',
                        borderRadius: '8px',
                        background: 'rgba(191, 201, 0, 0.1)',
                        border: '1px solid rgba(191, 201, 0, 0.3)',
                      }}
                    >
                      <p style={{ margin: 0, fontSize: '13px', lineHeight: '1.6', color: 'var(--color-text-primary, #e5e7eb)', fontStyle: 'italic' }}>
                        💬 <strong>Verdict du Coach :</strong> {analysis.coachVerdict}
                      </p>
                    </div>
                  )}
                </div>

                {/* Section "Ce que tu peux faire MAINTENANT" */}
                <div className="single-course-panel__card">
                  <p className="single-course-panel__title">🎯 OBJECTIF DES 4 PROCHAINES SEMAINES</p>
                  {analysis.next4WeeksGoals && (
                    <div style={{ marginTop: '12px' }}>
                      <ul className="single-course-panel__list" style={{ marginBottom: '12px' }}>
                        <li>
                          <span>Volume cible</span>
                          <span>
                            {analysis.next4WeeksGoals.volumeKm.min}–{analysis.next4WeeksGoals.volumeKm.max} km / semaine
                          </span>
                        </li>
                        <li>
                          <span>D+ cible</span>
                          <span>
                            {analysis.next4WeeksGoals.dPlus.min}–{analysis.next4WeeksGoals.dPlus.max} m / semaine
                          </span>
                        </li>
                        <li>
                          <span>Fréquence</span>
                          <span>{analysis.next4WeeksGoals.frequency} sorties / semaine</span>
                        </li>
                        <li>
                          <span>Sortie longue</span>
                          <span>1 sortie &gt; {analysis.next4WeeksGoals.longRunHours}h</span>
                        </li>
                      </ul>
                      <p style={{ marginTop: '12px', fontSize: '12px', color: 'var(--color-text-secondary, #9ca3af)', fontStyle: 'italic' }}>
                        Si ces objectifs sont atteints, ton état de préparation passera de{' '}
                        {analysis.readiness === 'risk' ? '🔴 Risque' : analysis.readiness === 'needs_work' ? '🟠 À renforcer' : '🟢 Prêt'} à{' '}
                        {analysis.projection.ifFollowsGoals.m3 === 'ready' ? '🟢 Prêt' : analysis.projection.ifFollowsGoals.m3 === 'needs_work' ? '🟠 À renforcer' : '🔴 Risque'}.
                      </p>
                    </div>
                  )}
                </div>

                <div className="single-course-panel__card">
                  <p className="single-course-panel__title">CHARGE &amp; RÉGULARITÉ (6 semaines)</p>
                  <ul className="single-course-panel__list">
                    <li>
                      <span>km / semaine</span>
                      <span>{metrics ? `${metrics.kmPerWeek} km` : '...'}</span>
                    </li>
                    <li>
                      <span>d+ / semaine</span>
                      <span>{metrics ? `${metrics.dPlusPerWeek} m` : '...'}</span>
                    </li>
                    <li>
                      <span>longue sortie max</span>
                      <span>
                        {metrics
                          ? `${metrics.longRunDistanceKm} km – ${metrics.longRunDPlus} d+`
                          : '...'}
                      </span>
                    </li>
                    <li>
                      <span>régularité</span>
                      <span
                        className={`single-course-panel__pill${
                          analysis.regularity === 'bonne' ? ' single-course-panel__pill--ok' : ''
                        }${analysis.regularity === 'faible' ? ' single-course-panel__pill--warning' : ''}`}
                        title={analysis.regularityDetails}
                      >
                        {analysis.regularity}
                      </span>
                    </li>
                    <li>
                      <span>variation charge</span>
                      <span>
                        {metrics
                          ? `${metrics.variation > 0 ? '+' : ''}${metrics.variation.toFixed(1)}% / semaine`
                          : '...'}
                      </span>
                    </li>
                  </ul>
                  {/* Estimation du temps de course */}
                  {analysis.timeEstimate && (
                    <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
                      <p style={{ fontSize: '12px', color: 'var(--color-text-secondary, #9ca3af)', marginBottom: '8px' }}>
                        ⏱️ Temps estimé de course
                      </p>
                      <p style={{ fontSize: '18px', fontWeight: 600, color: 'var(--color-accent, #bfc900)' }}>
                        {analysis.timeEstimate.rangeFormatted}
                      </p>
                      <p style={{ fontSize: '11px', color: 'var(--color-text-secondary, #9ca3af)', marginTop: '4px', fontStyle: 'italic' }}>
                        Basé sur ton allure actuelle, le dénivelé et la distance (fourchette indicative)
                      </p>
                    </div>
                  )}
                  
                  {/* Moteur de Simulation */}
                  {analysis.timeEstimate && (
                    <SimulationEngine
                      distanceKm={courseData.distanceKm}
                      elevationGain={courseData.elevationGain}
                      metrics={metrics}
                      baseTimeEstimate={analysis.timeEstimate}
                    />
                  )}
                </div>

                <div className="single-course-panel__card">
                  <p className="single-course-panel__title">AJUSTEMENTS RECOMMANDÉS</p>
                  
                  {/* Priorité immédiate */}
                  {analysis.immediateActions && analysis.immediateActions.length > 0 && (
                    <div style={{ marginTop: '12px', marginBottom: '16px' }}>
                      <p style={{ fontSize: '13px', color: '#ef4444', marginBottom: '8px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <FiAlertCircle style={{ width: '24px', height: '24px', flexShrink: 0 }} /> Priorité immédiate
                      </p>
                      <ul className="single-course-panel__list single-course-panel__list--bullets">
                        {analysis.immediateActions.map((action, idx) => (
                          <li key={idx} style={{ fontSize: '12px', marginBottom: '4px' }}>
                            {action}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Important mais secondaire */}
                  {analysis.secondaryActions && analysis.secondaryActions.length > 0 && (
                    <div style={{ marginBottom: '16px' }}>
                      <p style={{ fontSize: '13px', color: '#fbbf24', marginBottom: '8px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <FiAlertCircle style={{ width: '24px', height: '24px', flexShrink: 0 }} /> Important mais secondaire
                      </p>
                      <ul className="single-course-panel__list single-course-panel__list--bullets">
                        {analysis.secondaryActions.map((action, idx) => (
                          <li key={idx} style={{ fontSize: '12px', marginBottom: '4px' }}>
                            {action}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* À tester */}
                  {analysis.testActions && analysis.testActions.length > 0 && (
                    <div style={{ marginBottom: '16px' }}>
                      <p style={{ fontSize: '13px', color: '#9ca3af', marginBottom: '8px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <FiZap style={{ width: '24px', height: '24px', flexShrink: 0 }} /> À tester
                      </p>
                      <ul className="single-course-panel__list single-course-panel__list--bullets">
                        {analysis.testActions.map((action, idx) => (
                          <li key={idx} style={{ fontSize: '12px', marginBottom: '4px' }}>
                            {action}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>

                {/* Projection type "simulateur F1" */}
                <div className="single-course-panel__card">
                  <p className="single-course-panel__title">🧠 PROJECTION</p>
                  <div style={{ marginTop: '12px' }}>
                    <div style={{ marginBottom: '16px' }}>
                      <p style={{ fontSize: '12px', color: '#9ca3af', marginBottom: '8px', fontWeight: 500 }}>
                        Si tu continues ainsi
                      </p>
                      <ul className="single-course-panel__list" style={{ fontSize: '12px' }}>
                        <li>
                          <span>État prévu à M-3</span>
                          <span>
                            {analysis.projection.ifContinues.m3 === 'ready' ? '🟢 Prêt' : analysis.projection.ifContinues.m3 === 'needs_work' ? '🟠 À renforcer' : '🔴 Risque'}
                          </span>
                        </li>
                        <li>
                          <span>État prévu à M-1</span>
                          <span>
                            {analysis.projection.ifContinues.m1 === 'ready' ? '🟢 Prêt' : analysis.projection.ifContinues.m1 === 'needs_work' ? '🟠 À renforcer' : '🔴 Risque'}
                          </span>
                        </li>
                      </ul>
                    </div>
                    <div>
                      <p style={{ fontSize: '12px', color: '#22c55e', marginBottom: '8px', fontWeight: 500 }}>
                        Si tu suis les objectifs recommandés
                      </p>
                      <ul className="single-course-panel__list" style={{ fontSize: '12px' }}>
                        <li>
                          <span>État prévu à M-3</span>
                          <span>
                            {analysis.projection.ifFollowsGoals.m3 === 'ready' ? '🟢 Prêt' : analysis.projection.ifFollowsGoals.m3 === 'needs_work' ? '🟠 À renforcer' : '🔴 Risque'}
                          </span>
                        </li>
                        <li>
                          <span>État prévu à M-1</span>
                          <span>
                            {analysis.projection.ifFollowsGoals.m1 === 'ready' ? '🟢 Prêt (partiellement)' : analysis.projection.ifFollowsGoals.m1 === 'needs_work' ? '🟠 À renforcer' : '🔴 Risque'}
                          </span>
                        </li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>
        </main>
      </div>
    </div>
  )
}
