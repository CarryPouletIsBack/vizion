import { useEffect, useRef, useState } from 'react'
import './WebGlGlobe.css'

const BASE = typeof window !== 'undefined' ? window.location.origin + '/globe' : '/globe'

/** Marqueur course : id + coordonnées pour affichage et clic */
export type GlobeCourseMarker = { id: string; coordinates: [number, number] }
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
  /** Appelé quand l'utilisateur clique sur un point (course) sur le globe */
  onCourseSelect?: (courseId: string | undefined) => void
  /** Courses à afficher comme points cliquables (id + coordonnées) */
  courseMarkers?: GlobeCourseMarker[]
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

type GlobeInstance = {
  animate: () => void
  renderer?: { domElement: HTMLCanvasElement }
  scene?: { remove: (obj: unknown) => void }
  camera?: { getWorldDirection: (v: { set: (x: number, y: number, z: number) => void }) => void }
  points?: { geometry?: { faces?: unknown[] }; id?: number }
  addData?: (data: number[], opts: { format: string; animated: boolean }) => void
  createPoints?: () => void
}

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
  const [globeReady, setGlobeReady] = useState(false)

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
      setGlobeReady(true)

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
      setGlobeReady(false)
    }
  }, [])

  const courseIdsRef = useRef<string[]>([])
  courseIdsRef.current = (props.courseMarkers ?? []).map((m) => m.id)

  // Afficher les points des courses sur le globe + gestion du clic (raycasting)
  useEffect(() => {
    if (!globeReady) return
    const globe = globeRef.current
    const markers = props.courseMarkers ?? []
    if (!globe?.addData || !globe?.createPoints) return

    if (globe.points && globe.scene) {
      globe.scene.remove(globe.points)
      globe.points = undefined
    }

    if (markers.length > 0) {
      const flatData: number[] = []
      for (const { coordinates: [lat, lng] } of markers) {
        flatData.push(lat, lng, 0.015)
      }
      globe.addData(flatData, { format: 'magnitude', animated: false })
      globe.createPoints()
    }

    const container = containerRef.current
    const onCourseSelect = props.onCourseSelect
    if (!container || !onCourseSelect || markers.length === 0) return

    const THREE = (window as unknown as {
      THREE?: {
        Raycaster: unknown
        Vector2: unknown
        Vector3: unknown
        Mesh: unknown
        BoxGeometry: unknown
        MeshBasicMaterial: unknown
        FaceColors: unknown
        Color: unknown
      }
    }).THREE
    if (!THREE?.Raycaster || !THREE?.Vector2 || !THREE?.Vector3) return
    if (!THREE?.Mesh || !THREE?.BoxGeometry || !THREE?.MeshBasicMaterial) return

    const GLOBE_RADIUS = 200
    const Raycaster = THREE.Raycaster as new (a?: unknown, b?: unknown) => {
      set: (origin: unknown, direction: unknown) => void
      intersectObject: (o: unknown) => { faceIndex?: number; face?: unknown }[]
    }
    const Vector2 = THREE.Vector2 as new () => { set: (x: number, y: number) => void }
    const Vector3 = THREE.Vector3 as new () => {
      set: (x: number, y: number, z: number) => unknown
      unproject: (camera: unknown) => unknown
      subVectors: (a: unknown, b: unknown) => unknown
      normalize: () => unknown
      copy: (a: unknown) => unknown
    }
    const raycaster = new Raycaster()
    const mouse = new Vector2()
    const origin = new Vector3()
    const direction = new Vector3()
    const unprojectPoint = new Vector3()

    /** Position monde d’un point à partir de lat/lng (même formule que globe.js) */
    function pointWorldPosition(lat: number, lng: number, out: ReturnType<typeof Vector3>) {
      const phi = ((90 - lat) * Math.PI) / 180
      const theta = ((180 - lng) * Math.PI) / 180
      out.set(
        GLOBE_RADIUS * Math.sin(phi) * Math.cos(theta),
        GLOBE_RADIUS * Math.cos(phi),
        GLOBE_RADIUS * Math.sin(phi) * Math.sin(theta)
      )
      return out
    }

    /** Raycast et retourne l’index du point sous la souris, ou -1 */
    function getPointUnderMouse(e: MouseEvent): number {
      const globeInst = globeRef.current
      if (!globeInst?.points || !globeInst.camera || !globeInst.renderer?.domElement) return -1
      const canvas = globeInst.renderer.domElement
      const cam = globeInst.camera as { getWorldPosition: (v: unknown) => unknown }
      globeInst.points.updateMatrixWorld(true)
      const rect = canvas.getBoundingClientRect()
      mouse.set(
        ((e.clientX - rect.left) / rect.width) * 2 - 1,
        -((e.clientY - rect.top) / rect.height) * 2 + 1
      )
      cam.getWorldPosition(origin)
      unprojectPoint.set(mouse.x, mouse.y, 1)
      ;(unprojectPoint as { unproject: (c: unknown) => unknown }).unproject(cam)
      direction.subVectors(unprojectPoint, origin).normalize()
      raycaster.set(origin, direction)
      const hits = raycaster.intersectObject(globeInst.points)
      if (hits.length === 0) return -1
      const hit = hits[0]
      let faceIndex = hit.faceIndex
      if (faceIndex === undefined && hit.face != null && globeInst.points.geometry?.faces) {
        faceIndex = (globeInst.points.geometry as { faces: unknown[] }).faces.indexOf(hit.face)
      }
      if (faceIndex === undefined || faceIndex < 0) return -1
      const pointIndex = Math.floor(faceIndex / 12)
      const ids = courseIdsRef.current
      return pointIndex >= 0 && pointIndex < ids.length ? pointIndex : -1
    }

    const onGlobeClick = (e: MouseEvent) => {
      const pointIndex = getPointUnderMouse(e)
      if (pointIndex < 0) return
      const ids = courseIdsRef.current
      onCourseSelect(ids[pointIndex])
    }

    // Mesh de survol : même forme que les points mais plus grand (×1.5)
    const pointBaseSize = 0.015 * GLOBE_RADIUS // 3
    const hoverScale = pointBaseSize * 1.5 // 4.5
    const boxGeo = new (THREE.BoxGeometry as new (a: number, b: number, c: number) => unknown)(0.75, 0.75, 1) as {
      dispose?: () => void
    }
    const boxMat = new (THREE.MeshBasicMaterial as new (o: unknown) => unknown)({
      color: 0xffffff,
      vertexColors: THREE.FaceColors,
    }) as { dispose?: () => void }
    const highlightMesh = new (THREE.Mesh as new (g: unknown, m: unknown) => {
      position: { set: (x: number, y: number, z: number) => void }
      scale: { set: (x: number, y: number, z: number) => void }
      lookAt: (v: unknown) => void
      visible: boolean
    })(boxGeo, boxMat)
    highlightMesh.scale.set(hoverScale, hoverScale, hoverScale)
    highlightMesh.visible = false
    const center = new Vector3()
    center.set(0, 0, 0)
    ;(highlightMesh as { lookAt: (v: unknown) => void }).lookAt(center)
    ;(globe.scene as { add: (o: unknown) => void }).add(highlightMesh)

    const onGlobeMouseMove = (e: MouseEvent) => {
      const globeInst = globeRef.current
      const pointIndex = getPointUnderMouse(e)
      const canvas = globeInst?.renderer?.domElement
      if (canvas) canvas.style.cursor = pointIndex >= 0 ? 'pointer' : 'default'
      if (pointIndex < 0) {
        highlightMesh.visible = false
        return
      }
      const coords = markers[pointIndex]?.coordinates
      if (!coords) return
      const [lat, lng] = coords
      pointWorldPosition(lat, lng, origin)
      highlightMesh.position.set(
        (origin as { x: number; y: number; z: number }).x,
        (origin as { x: number; y: number; z: number }).y,
        (origin as { x: number; y: number; z: number }).z
      )
      ;(highlightMesh as { lookAt: (v: unknown) => void }).lookAt(center)
      highlightMesh.visible = true
    }

    const onGlobeMouseLeave = () => {
      const globeInst = globeRef.current
      if (globeInst?.renderer?.domElement) globeInst.renderer.domElement.style.cursor = 'default'
      highlightMesh.visible = false
    }

    const canvas = globe.renderer?.domElement
    if (canvas) {
      canvas.addEventListener('click', onGlobeClick)
      canvas.addEventListener('mousemove', onGlobeMouseMove)
      canvas.addEventListener('mouseleave', onGlobeMouseLeave)
      return () => {
        canvas.removeEventListener('click', onGlobeClick)
        canvas.removeEventListener('mousemove', onGlobeMouseMove)
        canvas.removeEventListener('mouseleave', onGlobeMouseLeave)
        ;(globe.scene as { remove: (o: unknown) => void }).remove(highlightMesh)
        boxGeo.dispose?.()
        boxMat.dispose?.()
      }
    }
  }, [globeReady, props.courseMarkers, props.onCourseSelect])

  return (
    <div className="webgl-globe" ref={containerRef} aria-label="Globe WebGL" />
  )
}
