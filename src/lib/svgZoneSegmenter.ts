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

  // Récupérer le viewBox pour calculer les coordonnées
  const viewBoxAttr = svgElement.getAttribute('viewBox')
  const viewBox = viewBoxAttr ? viewBoxAttr.split(' ').map(Number) : [0, 0, 302, 258]
  const [minX, minY, width, height] = viewBox

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
    if (target.tagName === 'path' && target.getAttribute('data-zone-index') !== null) {
      showTooltip(e, target)
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
