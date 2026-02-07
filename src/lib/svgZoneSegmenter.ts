/**
 * Segmentation du tracé SVG en zones colorées selon la difficulté
 * Ajoute des tooltips au survol
 */

import type { ProfileZone } from './profileAnalysis'

/**
 * Ajoute des zones colorées et des tooltips au SVG GPX
 */
export function segmentSvgWithZones(
  svgContent: string,
  zones: ProfileZone[],
  profile: Array<[number, number]>
): string {
  if (!svgContent || zones.length === 0 || profile.length === 0) {
    return svgContent
  }

  try {
    const parser = new DOMParser()
    const doc = parser.parseFromString(svgContent, 'image/svg+xml')
    const svgElement = doc.querySelector('svg')
    const pathElement = doc.querySelector('path')

  if (!svgElement || !pathElement) {
    return svgContent
  }

  // Normaliser le profil pour mapper distance → coordonnées SVG
  const maxDistance = profile[profile.length - 1]?.[0] || 1

  // Récupérer le path original pour extraire les coordonnées
  const originalPathData = pathElement.getAttribute('d') || ''
  
  // Parser le path pour obtenir les points (approximation simple)
  const pathPoints = parsePathData(originalPathData)
  
  if (pathPoints.length === 0) {
    return svgContent
  }

  // Créer un groupe pour les zones (sous le path original)
  const zonesGroup = doc.createElementNS('http://www.w3.org/2000/svg', 'g')
  zonesGroup.setAttribute('id', 'zones-group')

  // Créer les segments de path pour chaque zone
  zones.forEach((zone, index) => {
    // Trouver les points du profil dans cette zone
    const zoneProfilePoints = profile.filter(
      ([dist]) => dist >= zone.startDistance && dist <= zone.endDistance
    )

    if (zoneProfilePoints.length < 2) return

    // Calculer les ratios de distance pour mapper sur le path original
    const startRatio = zone.startDistance / maxDistance
    const endRatio = zone.endDistance / maxDistance

    // Extraire les points du path original correspondant à cette zone
    const startIndex = Math.floor(startRatio * pathPoints.length)
    const endIndex = Math.ceil(endRatio * pathPoints.length)
    const zonePathPoints = pathPoints.slice(startIndex, endIndex + 1)

    if (zonePathPoints.length < 2) return

    // Créer un segment de path pour cette zone
    const zonePath = doc.createElementNS('http://www.w3.org/2000/svg', 'path')
    const zonePathData = 'M ' + zonePathPoints.map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`).join(' L ')
    
    zonePath.setAttribute('d', zonePathData)
    zonePath.setAttribute('fill', 'none')
    zonePath.setAttribute('stroke', zone.color)
    zonePath.setAttribute('stroke-width', '3')
    zonePath.setAttribute('stroke-linecap', 'round')
    zonePath.setAttribute('stroke-linejoin', 'round')
    zonePath.setAttribute('opacity', '0.9')
    zonePath.setAttribute('data-zone-index', String(index))
    zonePath.setAttribute('data-difficulty', zone.difficulty)
    zonePath.setAttribute('data-description', zone.description)
    zonePath.setAttribute('data-start-distance', String(zone.startDistance))
    zonePath.setAttribute('data-end-distance', String(zone.endDistance))
    zonePath.setAttribute('data-elevation-gain', String(zone.elevationGain))
    zonePath.setAttribute('data-elevation-loss', String(zone.elevationLoss))
    zonePath.setAttribute('data-grade', String(zone.averageGrade.toFixed(1)))
    
    // Ajouter un style pour le curseur
    zonePath.setAttribute('style', 'cursor: pointer;')
    
    // Ajouter un titre pour le tooltip natif SVG
    const title = doc.createElementNS('http://www.w3.org/2000/svg', 'title')
    title.textContent = `${zone.description} | ${zone.startDistance.toFixed(1)}-${zone.endDistance.toFixed(1)} km | D+: ${zone.elevationGain}m D-: ${zone.elevationLoss}m`
    zonePath.appendChild(title)

    zonesGroup.appendChild(zonePath)
  })

  // Insérer le groupe de zones avant le path original (pour que le path original soit au-dessus)
  svgElement.insertBefore(zonesGroup, pathElement)

  // Augmenter le stroke-width du path original pour qu'il soit visible au-dessus
  const currentStrokeWidth = pathElement.getAttribute('stroke-width') || '2'
  pathElement.setAttribute('stroke-width', String(Math.max(3, Number(currentStrokeWidth) + 1)))
  pathElement.setAttribute('stroke', '#ffffff')
  pathElement.setAttribute('opacity', '0.6')

  return new XMLSerializer().serializeToString(doc)
  } catch (error) {
    console.warn('Erreur lors de la segmentation du SVG:', error)
    return svgContent
  }
}

/** Palette de couleurs pour les segments numérotés (alternance) */
const SEGMENT_COLORS = ['#bfc900', '#9ca3af', '#6b7280', '#4b5563']

/**
 * Segmente le tracé GPX en segments numérotés (Segment 1, 2, 3...).
 * Chaque segment est dessiné avec une couleur et un label au début.
 */
export function segmentSvgIntoNumberedSegments(
  svgContent: string,
  profile: Array<[number, number]>,
  numSegments: number = 10
): string {
  if (!svgContent || profile.length === 0 || numSegments < 1) {
    return svgContent
  }

  try {
    const parser = new DOMParser()
    const doc = parser.parseFromString(svgContent, 'image/svg+xml')
    const svgElement = doc.querySelector('svg')
    const pathElement = doc.querySelector('path')
    if (!svgElement || !pathElement) return svgContent

    const pathData = pathElement.getAttribute('d') || ''
    const pathPoints = parsePathData(pathData)
    if (pathPoints.length < 2) return svgContent

    const maxDistance = profile[profile.length - 1]?.[0] || 1
    const n = Math.min(Math.max(1, numSegments), 30)

    const segmentsGroup = doc.createElementNS('http://www.w3.org/2000/svg', 'g')
    segmentsGroup.setAttribute('id', 'gpx-numbered-segments')

    for (let i = 0; i < n; i++) {
      const startRatio = i / n
      const endRatio = (i + 1) / n
      const startIndex = Math.floor(startRatio * pathPoints.length)
      const endIndex = i === n - 1 ? pathPoints.length : Math.ceil(endRatio * pathPoints.length)
      const segmentPoints = pathPoints.slice(startIndex, endIndex + 1)
      if (segmentPoints.length < 2) continue

      const d = 'M ' + segmentPoints.map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`).join(' L ')
      const startDist = (startRatio * maxDistance).toFixed(1)
      const endDist = (endRatio * maxDistance).toFixed(1)

      const segmentPathHit = doc.createElementNS('http://www.w3.org/2000/svg', 'path')
      segmentPathHit.setAttribute('d', d)
      segmentPathHit.setAttribute('fill', 'none')
      segmentPathHit.setAttribute('stroke', 'transparent')
      segmentPathHit.setAttribute('stroke-width', '16')
      segmentPathHit.setAttribute('stroke-linecap', 'round')
      segmentPathHit.setAttribute('stroke-linejoin', 'round')
      segmentPathHit.setAttribute('class', 'gpx-segment gpx-segment-hit')
      segmentPathHit.setAttribute('style', 'cursor: pointer;')
      segmentPathHit.setAttribute('data-segment-index', String(i))
      segmentPathHit.setAttribute('data-segment-number', String(i + 1))
      segmentPathHit.setAttribute('data-start-distance', startDist)
      segmentPathHit.setAttribute('data-end-distance', endDist)
      const titleHit = doc.createElementNS('http://www.w3.org/2000/svg', 'title')
      titleHit.textContent = `Segment ${i + 1} | ${startDist} - ${endDist} km — Cliquez pour sélectionner`
      segmentPathHit.appendChild(titleHit)
      segmentsGroup.appendChild(segmentPathHit)

      const segmentPath = doc.createElementNS('http://www.w3.org/2000/svg', 'path')
      segmentPath.setAttribute('d', d)
      segmentPath.setAttribute('fill', 'none')
      segmentPath.setAttribute('stroke', SEGMENT_COLORS[i % SEGMENT_COLORS.length])
      segmentPath.setAttribute('stroke-width', '2.5')
      segmentPath.setAttribute('stroke-linecap', 'round')
      segmentPath.setAttribute('stroke-linejoin', 'round')
      segmentPath.setAttribute('opacity', '0.95')
      segmentPath.setAttribute('data-segment-index', String(i))
      segmentPath.setAttribute('data-segment-number', String(i + 1))
      segmentPath.setAttribute('data-start-distance', startDist)
      segmentPath.setAttribute('data-end-distance', endDist)
      segmentPath.setAttribute('class', 'gpx-segment gpx-segment-stroke')
      segmentPath.setAttribute('style', 'pointer-events: none;')
      const title = doc.createElementNS('http://www.w3.org/2000/svg', 'title')
      title.textContent = `Segment ${i + 1} | ${startDist} - ${endDist} km`
      segmentPath.appendChild(title)
      segmentsGroup.appendChild(segmentPath)

      const [labelX, labelY] = segmentPoints[0]
      const text = doc.createElementNS('http://www.w3.org/2000/svg', 'text')
      text.setAttribute('x', String(labelX))
      text.setAttribute('y', String(labelY))
      text.setAttribute('text-anchor', 'middle')
      text.setAttribute('dominant-baseline', 'middle')
      text.setAttribute('fill', '#0b0e11')
      text.setAttribute('font-size', '10')
      text.setAttribute('font-weight', '700')
      text.setAttribute('stroke', '#e5e7eb')
      text.setAttribute('stroke-width', '1.5')
      text.setAttribute('paint-order', 'stroke')
      text.setAttribute('pointer-events', 'none')
      text.textContent = String(i + 1)
      segmentsGroup.appendChild(text)
    }

    svgElement.insertBefore(segmentsGroup, pathElement)
    pathElement.setAttribute('stroke', 'rgba(178, 170, 170, 0.4)')
    pathElement.setAttribute('stroke-width', '1')
    pathElement.setAttribute('opacity', '0.5')
    pathElement.setAttribute('style', 'pointer-events: none;')
    pathElement.setAttribute('class', 'gpx-trace-background')

    return new XMLSerializer().serializeToString(doc)
  } catch (err) {
    console.warn('Erreur segmentation GPX en segments numérotés:', err)
    return svgContent
  }
}

export type SegmentClickPayload = {
  segmentIndex: number
  segmentNumber: number
  startKm: number
  endKm: number
}

/**
 * Attache les listeners de clic sur les segments du tracé GPX.
 * Au clic : mise en évidence du segment (classe gpx-segment--selected) et appel du callback.
 */
export function addSvgSegmentClickListeners(
  svgElementId: string,
  onSegmentClick: (payload: SegmentClickPayload) => void
): () => void {
  const svgElement = document.getElementById(svgElementId)
  if (!svgElement) return () => {}

  const handleClick = (e: MouseEvent) => {
    const target = e.target as SVGPathElement
    if (target.tagName !== 'path' || !target.getAttribute('data-segment-number')) return

    const num = target.getAttribute('data-segment-number')
    const index = target.getAttribute('data-segment-index')
    const startKm = target.getAttribute('data-start-distance')
    const endKm = target.getAttribute('data-end-distance')
    if (num == null || index == null || startKm == null || endKm == null) return

    const hitPaths = svgElement.querySelectorAll('path.gpx-segment-hit')
    const strokePaths = svgElement.querySelectorAll('path.gpx-segment-stroke')
    hitPaths.forEach((p) => p.classList.remove('gpx-segment--selected'))
    strokePaths.forEach((p) => p.classList.remove('gpx-segment--selected'))
    target.classList.add('gpx-segment--selected')
    const strokePath = strokePaths[Number(index)]
    if (strokePath) strokePath.classList.add('gpx-segment--selected')

    onSegmentClick({
      segmentIndex: Number(index),
      segmentNumber: Number(num),
      startKm: Number(startKm),
      endKm: Number(endKm),
    })
  }

  svgElement.addEventListener('click', handleClick)

  return () => {
    svgElement.removeEventListener('click', handleClick)
  }
}

/**
 * Parse un path SVG pour extraire les points de coordonnées
 */
function parsePathData(pathData: string): Array<[number, number]> {
  const points: Array<[number, number]> = []
  
  // Pattern simple pour extraire les coordonnées M x,y L x,y L x,y ...
  const commands = pathData.match(/[ML]\s*([\d.-]+),([\d.-]+)/g) || []
  
  commands.forEach((cmd) => {
    const match = cmd.match(/([\d.-]+),([\d.-]+)/)
    if (match) {
      const x = parseFloat(match[1])
      const y = parseFloat(match[2])
      if (!isNaN(x) && !isNaN(y)) {
        points.push([x, y])
      }
    }
  })
  
  return points
}

/** Padding autour du segment (en unités SVG) pour le zoom */
const SEGMENT_ZOOM_PADDING = 15

/**
 * Retourne un SVG avec la viewBox zoomée sur le segment (startKm – endKm).
 * Utilisé sur la page segment pour afficher uniquement le tronçon sélectionné.
 */
export function getSvgZoomedOnSegment(
  svgContent: string,
  startKm: number,
  endKm: number,
  totalKm: number
): string {
  if (!svgContent || totalKm <= 0 || endKm <= startKm) return svgContent
  try {
    const parser = new DOMParser()
    const doc = parser.parseFromString(svgContent, 'image/svg+xml')
    const svgElement = doc.querySelector('svg')
    const fullPath =
      doc.querySelector('path.gpx-trace-background') || doc.querySelector('path')
    if (!svgElement || !fullPath) return svgContent

    const pathData = fullPath.getAttribute('d') || ''
    const pathPoints = parsePathData(pathData)
    if (pathPoints.length < 2) return svgContent

    const startRatio = Math.max(0, startKm / totalKm)
    const endRatio = Math.min(1, endKm / totalKm)
    const startIndex = Math.floor(startRatio * pathPoints.length)
    const endIndex = Math.min(
      pathPoints.length - 1,
      Math.ceil(endRatio * pathPoints.length)
    )
    const segmentPoints = pathPoints.slice(startIndex, endIndex + 1)
    if (segmentPoints.length < 2) return svgContent

    const xs = segmentPoints.map(([x]) => x)
    const ys = segmentPoints.map(([, y]) => y)
    const minX = Math.min(...xs)
    const maxX = Math.max(...xs)
    const minY = Math.min(...ys)
    const maxY = Math.max(...ys)
    const width = maxX - minX || 1
    const height = maxY - minY || 1
    const pad = Math.max(SEGMENT_ZOOM_PADDING, width * 0.1, height * 0.1)
    const x = minX - pad
    const y = minY - pad
    const w = width + 2 * pad
    const h = height + 2 * pad
    const viewBox = `${x} ${y} ${w} ${h}`
    svgElement.setAttribute('viewBox', viewBox)
    svgElement.setAttribute('preserveAspectRatio', 'xMidYMid meet')
    return new XMLSerializer().serializeToString(doc)
  } catch (err) {
    console.warn('Erreur zoom SVG sur segment:', err)
    return svgContent
  }
}

/**
 * Interpole l'élévation à la distance d (profil = [distance, élévation]).
 */
function interpolateElevation(profile: Array<[number, number]>, distance: number): number {
  if (!profile.length) return 0
  if (profile.length === 1) return profile[0][1]
  if (distance <= profile[0][0]) return profile[0][1]
  if (distance >= profile[profile.length - 1][0]) return profile[profile.length - 1][1]
  for (let i = 0; i < profile.length - 1; i++) {
    const [d0, e0] = profile[i]
    const [d1, e1] = profile[i + 1]
    if (distance >= d0 && distance <= d1) {
      const t = (distance - d0) / (d1 - d0 || 1)
      return e0 + t * (e1 - e0)
    }
  }
  return profile[profile.length - 1][1]
}

/**
 * Retourne un SVG du segment où le tracé est déformé selon l'élévation :
 * les parties en montée sont "relevées" et en descente "abaissées" dans le SVG.
 * À afficher avec une inclinaison CSS (rotateX) pour voir le relief.
 */
export function getSegmentSvgWithElevation(
  svgContent: string,
  startKm: number,
  endKm: number,
  totalKm: number,
  segmentProfile: Array<[number, number]>,
  options?: { strokeColor?: string; elevationScale?: number }
): string {
  if (!svgContent || totalKm <= 0 || endKm <= startKm || segmentProfile.length < 2) return svgContent
  const pathPoints = getSegmentPathPoints(svgContent, startKm, endKm, totalKm)
  if (pathPoints.length < 2) return svgContent

  const segmentLength = segmentProfile[segmentProfile.length - 1][0]
  if (segmentLength <= 0) return svgContent

  const elevations = pathPoints.map((_, i) => {
    const dist = segmentLength * (i / Math.max(1, pathPoints.length - 1))
    return interpolateElevation(segmentProfile, dist)
  })
  const minElev = Math.min(...elevations)
  const maxElev = Math.max(...elevations)
  const elevRange = Math.max(maxElev - minElev, 1)
  const strokeColor = options?.strokeColor ?? '#bfc900'
  const elevationScale = options?.elevationScale ?? 1.2

  const extentX = Math.max(...pathPoints.map(([x]) => x)) - Math.min(...pathPoints.map(([x]) => x)) || 1
  const extentY = Math.max(...pathPoints.map(([, y]) => y)) - Math.min(...pathPoints.map(([, y]) => y)) || 1
  const extentHoriz = Math.max(extentX, extentY)
  const scaleElev = (elevationScale * extentHoriz) / elevRange

  const pointsWithElev = pathPoints.map(([px, py], i) => {
    const elev = elevations[i]
    const yOffset = (elev - minElev) * scaleElev
    return [px, py - yOffset] as [number, number]
  })

  const xs = pointsWithElev.map(([x]) => x)
  const ys = pointsWithElev.map(([, y]) => y)
  const minX = Math.min(...xs)
  const maxX = Math.max(...xs)
  const minY = Math.min(...ys)
  const maxY = Math.max(...ys)
  const pad = 20
  const viewBox = `${minX - pad} ${minY - pad} ${maxX - minX + 2 * pad} ${maxY - minY + 2 * pad}`
  const d = 'M ' + pointsWithElev.map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`).join(' L ')

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" preserveAspectRatio="xMidYMid meet">
  <path class="gpx-trace-background" fill="none" stroke="${strokeColor}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" d="${d}" />
</svg>`
}

/**
 * Retourne les points du path SVG pour le segment (startKm – endKm).
 * Utilisé pour la vue 3D du segment (tracé avec élévation).
 */
export function getSegmentPathPoints(
  svgContent: string,
  startKm: number,
  endKm: number,
  totalKm: number
): Array<[number, number]> {
  if (!svgContent || totalKm <= 0 || endKm <= startKm) return []
  try {
    const parser = new DOMParser()
    const doc = parser.parseFromString(svgContent, 'image/svg+xml')
    const fullPath =
      doc.querySelector('path.gpx-trace-background') || doc.querySelector('path')
    if (!fullPath) return []

    const pathData = fullPath.getAttribute('d') || ''
    const pathPoints = parsePathData(pathData)
    if (pathPoints.length < 2) return []

    const startRatio = Math.max(0, startKm / totalKm)
    const endRatio = Math.min(1, endKm / totalKm)
    const startIndex = Math.floor(startRatio * pathPoints.length)
    const endIndex = Math.min(
      pathPoints.length - 1,
      Math.ceil(endRatio * pathPoints.length)
    )
    return pathPoints.slice(startIndex, endIndex + 1)
  } catch (err) {
    console.warn('Erreur getSegmentPathPoints:', err)
    return []
  }
}

/**
 * Ajoute des event listeners pour les tooltips personnalisés
 */
export function addSvgTooltips(svgElementId: string): () => void {
  const svgElement = document.getElementById(svgElementId)
  if (!svgElement) return () => {}

  let tooltip: HTMLDivElement | null = null

  const createTooltip = (): HTMLDivElement => {
    const div = document.createElement('div')
    div.style.cssText = `
      position: absolute;
      background: rgba(11, 14, 17, 0.95);
      border: 1px solid rgba(191, 201, 0, 0.5);
      border-radius: 8px;
      padding: 8px 12px;
      color: #e5e7eb;
      font-size: 12px;
      pointer-events: none;
      z-index: 1000;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5);
      max-width: 250px;
    `
    div.style.display = 'none'
    document.body.appendChild(div)
    return div
  }

  const showTooltip = (e: MouseEvent, path: SVGPathElement) => {
    if (!tooltip) tooltip = createTooltip()

    const difficulty = path.getAttribute('data-difficulty') || ''
    const description = path.getAttribute('data-description') || ''
    const startDist = path.getAttribute('data-start-distance') || '0'
    const endDist = path.getAttribute('data-end-distance') || '0'
    const elevGain = path.getAttribute('data-elevation-gain') || '0'
    const elevLoss = path.getAttribute('data-elevation-loss') || '0'
    const grade = path.getAttribute('data-grade') || '0'

    const difficultyLabels: Record<string, string> = {
      easy: '🟢 Facile',
      moderate: '🟠 Modéré',
      hard: '🔴 Difficile',
      critical: '⚫ Critique',
    }

    tooltip.innerHTML = `
      <div style="font-weight: 600; margin-bottom: 4px; color: ${path.getAttribute('stroke') || '#bfc900'}">
        ${difficultyLabels[difficulty] || difficulty}
      </div>
      <div style="margin-bottom: 2px;">${description}</div>
      <div style="font-size: 11px; color: #9ca3af; margin-top: 4px;">
        Distance: ${Number(startDist).toFixed(1)} - ${Number(endDist).toFixed(1)} km<br/>
        D+: ${Number(elevGain).toFixed(0)} m | D-: ${Number(elevLoss).toFixed(0)} m<br/>
        Pente moyenne: ${Number(grade).toFixed(1)}%
      </div>
    `

    tooltip.style.display = 'block'
    tooltip.style.left = `${e.pageX + 10}px`
    tooltip.style.top = `${e.pageY + 10}px`
  }

  const hideTooltip = () => {
    if (tooltip) {
      tooltip.style.display = 'none'
    }
  }

  const handleMouseMove = (e: MouseEvent) => {
    const target = e.target as SVGPathElement
    const isZone = target.tagName === 'path' && target.getAttribute('data-zone-index') !== null
    const isSegment = target.tagName === 'path' && target.getAttribute('data-segment-number') !== null
    if (isZone) {
      showTooltip(e, target)
    } else if (isSegment) {
      if (!tooltip) tooltip = createTooltip()
      const num = target.getAttribute('data-segment-number') || '?'
      const startDist = target.getAttribute('data-start-distance') || '0'
      const endDist = target.getAttribute('data-end-distance') || '0'
      tooltip.innerHTML = `<div style="font-weight: 600; margin-bottom: 4px;">Segment ${num}</div><div style="font-size: 11px; color: #9ca3af;">${Number(startDist).toFixed(1)} - ${Number(endDist).toFixed(1)} km</div>`
      tooltip.style.display = 'block'
      tooltip.style.left = `${e.pageX + 10}px`
      tooltip.style.top = `${e.pageY + 10}px`
    } else {
      hideTooltip()
    }
  }

  const handleMouseLeave = () => {
    hideTooltip()
  }

  svgElement.addEventListener('mousemove', handleMouseMove)
  svgElement.addEventListener('mouseleave', handleMouseLeave)

  return () => {
    svgElement.removeEventListener('mousemove', handleMouseMove)
    svgElement.removeEventListener('mouseleave', handleMouseLeave)
    if (tooltip) {
      document.body.removeChild(tooltip)
    }
  }
}
