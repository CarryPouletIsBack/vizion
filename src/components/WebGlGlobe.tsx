import { useEffect, useRef } from 'react'
import './WebGlGlobe.css'

const BASE = typeof window !== 'undefined' ? window.location.origin + '/globe' : '/globe'
const SCRIPTS = [
  `${BASE}/third-party/Detector.js`,
  `${BASE}/third-party/three.min.js`,
  `${BASE}/third-party/Tween.js`,
  `${BASE}/globe.js`,
]

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) {
      resolve()
      return
    }
    const script = document.createElement('script')
    script.src = src
    script.async = false
    script.onload = () => resolve()
    script.onerror = () => reject(new Error(`Failed to load ${src}`))
    document.head.appendChild(script)
  })
}

/** Convertit une couleur hex/CSS en [r, g, b] 0–1 */
function parseColorToRgb(color: string | [number, number, number] | undefined): [number, number, number] | undefined {
  if (color == null) return undefined
  if (Array.isArray(color) && color.length >= 3) return [color[0], color[1], color[2]]
  if (typeof color !== 'string') return undefined
  const hex = color.replace(/^#/, '')
  if (hex.length === 6) {
    const r = parseInt(hex.slice(0, 2), 16) / 255
    const g = parseInt(hex.slice(2, 4), 16) / 255
    const b = parseInt(hex.slice(4, 6), 16) / 255
    return [r, g, b]
  }
  return undefined
}

export type WebGlGlobeProps = {
  onCourseSelect?: (courseId?: string) => void
  textureUrl?: string
  atmosphereColor?: string | [number, number, number]
  backgroundColor?: string | [number, number, number]
  autoRotateSpeed?: number
  zoomMin?: number
  zoomMax?: number
  initialRotation?: { x?: number; y?: number }
  lineColor?: string | [number, number, number]
  lineThickness?: number
}

type GlobeInstance = { animate: () => void; renderer?: { domElement: Element } }

type GlobeOpts = {
  imgDir?: string
  textureUrl?: string
  atmosphereColor?: [number, number, number]
  backgroundColor?: string | [number, number, number]
  autoRotateSpeed?: number
  zoomMin?: number
  zoomMax?: number
  initialRotation?: { x?: number; y?: number }
  lineColor?: [number, number, number]
  lineThickness?: number
}

export default function WebGlGlobe(props: WebGlGlobeProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const globeRef = useRef<GlobeInstance | null>(null)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const win = window as unknown as {
      __GLOBE_CANCELLED__?: boolean
      Detector?: { webgl: boolean; addGetWebGLMessage?: () => void }
      DAT?: { Globe: new (c: HTMLElement, o?: GlobeOpts) => GlobeInstance }
    }
    win.__GLOBE_CANCELLED__ = false

    const imgDir = BASE.endsWith('/') ? BASE : BASE + '/'
    const opts: GlobeOpts = { imgDir }

    if (props.textureUrl != null) opts.textureUrl = props.textureUrl
    const atm = parseColorToRgb(props.atmosphereColor as string | [number, number, number] | undefined)
    if (atm) opts.atmosphereColor = atm
    if (props.backgroundColor != null) opts.backgroundColor = Array.isArray(props.backgroundColor) ? props.backgroundColor : props.backgroundColor
    if (props.autoRotateSpeed != null) opts.autoRotateSpeed = props.autoRotateSpeed
    if (props.zoomMin != null) opts.zoomMin = props.zoomMin
    if (props.zoomMax != null) opts.zoomMax = props.zoomMax
    if (props.initialRotation != null) opts.initialRotation = props.initialRotation
    const lineRgb = parseColorToRgb(props.lineColor as string | [number, number, number] | undefined)
    if (lineRgb) opts.lineColor = lineRgb
    if (props.lineThickness != null) opts.lineThickness = props.lineThickness

    let resizeCleanup: (() => void) | undefined

    const init = async () => {
      try {
        for (const src of SCRIPTS) {
          await loadScript(src)
        }
      } catch (e) {
        console.warn('WebGL Globe: script load failed', e)
        return
      }

      if (!win.Detector?.webgl) {
        if (win.Detector?.addGetWebGLMessage) win.Detector.addGetWebGLMessage()
        return
      }
      if (!win.DAT?.Globe) return

      const globe = new win.DAT.Globe(container, opts)
      globeRef.current = globe
      globe.animate()

      const ro = new ResizeObserver(() => {
        window.dispatchEvent(new Event('resize'))
      })
      ro.observe(container)
      resizeCleanup = () => ro.disconnect()
    }

    init()

    return () => {
      resizeCleanup?.()
      win.__GLOBE_CANCELLED__ = true
      const globe = globeRef.current
      if (container && globe?.renderer?.domElement?.parentNode === container) {
        try {
          container.removeChild(globe.renderer.domElement)
        } catch {
          // already removed
        }
      }
      globeRef.current = null
    }
  }, [])

  return (
    <div className="webgl-globe" ref={containerRef} aria-label="Globe WebGL" />
  )
}
