import { useEffect } from 'react'

type HoverDetail = {
  distance: number
  elevation: number
  totalDistance?: number
}

export default function useGpxHoverMarker(svgId: string, maxDistance?: number) {
  useEffect(() => {
    const handler = (event: Event) => {
      const custom = event as CustomEvent<HoverDetail>
      const svgEl = document.getElementById(svgId) as SVGElement | null
      if (!svgEl) return

      const path = svgEl.querySelector('path, polyline')
      if (!path) return

      const totalLength = (path as SVGGeometryElement).getTotalLength?.()
      if (!totalLength || Number.isNaN(totalLength)) return

      const maxDist = (custom.detail.totalDistance ?? maxDistance ?? custom.detail.distance) || 1
      const ratio = Math.min(1, Math.max(0, custom.detail.distance / maxDist))
      const pos = (path as SVGGeometryElement).getPointAtLength(totalLength * ratio)

      let marker = svgEl.querySelector('#gpx-hover-marker') as SVGCircleElement | null
      if (!marker) {
        marker = document.createElementNS('http://www.w3.org/2000/svg', 'circle')
        marker.setAttribute('id', 'gpx-hover-marker')
        marker.setAttribute('r', '6')
        marker.setAttribute('fill', '#ffe500')
        marker.setAttribute('stroke', '#0b0e11')
        marker.setAttribute('stroke-width', '1')
        svgEl.appendChild(marker)
      }
      marker.setAttribute('cx', `${pos.x}`)
      marker.setAttribute('cy', `${pos.y}`)
      marker.setAttribute('opacity', '1')
    }

    window.addEventListener('gpx-hover', handler)
    return () => window.removeEventListener('gpx-hover', handler)
  }, [svgId, maxDistance])
}
