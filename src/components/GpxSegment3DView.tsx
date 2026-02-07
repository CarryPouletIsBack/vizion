import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import './GpxSegment3DView.css'

/** Interpole l'élévation à la distance d à partir du profil [distance, élévation] */
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

export type GpxSegment3DViewProps = {
  /** Points du path SVG du segment [[x,y], ...] */
  pathPoints: Array<[number, number]>
  /** Profil du segment [[distance depuis début segment, élévation], ...] */
  segmentProfile: Array<[number, number]>
  /** Couleur du tracé (hex ou CSS) */
  strokeColor?: string
  /** Hauteur du conteneur en px (optionnel, sinon 100%) */
  height?: number
}

const DEFAULT_STROKE = '#bfc900'

export default function GpxSegment3DView({
  pathPoints,
  segmentProfile,
  strokeColor = DEFAULT_STROKE,
  height = 280,
}: GpxSegment3DViewProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const sceneRef = useRef<THREE.Scene | null>(null)
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null)
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null)
  const lineRef = useRef<THREE.Line | null>(null)
  const frameRef = useRef<number>(0)

  useEffect(() => {
    const container = containerRef.current
    if (!container || pathPoints.length < 2 || segmentProfile.length < 2) return

    const segmentLength = segmentProfile[segmentProfile.length - 1][0]
    if (segmentLength <= 0) return

    const points3D: THREE.Vector3[] = []
    for (let i = 0; i < pathPoints.length; i++) {
      const [px, py] = pathPoints[i]
      const dist = segmentLength * (i / Math.max(1, pathPoints.length - 1))
      const elev = interpolateElevation(segmentProfile, dist)
      points3D.push(new THREE.Vector3(px, elev, py))
    }

    const minX = Math.min(...points3D.map((p) => p.x))
    const maxX = Math.max(...points3D.map((p) => p.x))
    const minY = Math.min(...points3D.map((p) => p.y))
    const maxY = Math.max(...points3D.map((p) => p.y))
    const minZ = Math.min(...points3D.map((p) => p.z))
    const maxZ = Math.max(...points3D.map((p) => p.z))
    const cx = (minX + maxX) / 2
    const cy = (minY + maxY) / 2
    const cz = (minZ + maxZ) / 2
    const extentX = Math.max(maxX - minX, 1)
    const extentZ = Math.max(maxZ - minZ, 1)

    /** Exagération verticale pour que le relief soit bien visible (Y = élévation) */
    const verticalExaggeration = 5
    const extentHoriz = Math.max(extentX, extentZ)
    const scaleXZ = 2 / extentHoriz
    const scaleY = (2 / extentHoriz) * verticalExaggeration

    let normalized = points3D.map(
      (p) =>
        new THREE.Vector3(
          (p.x - cx) * scaleXZ,
          (p.y - cy) * scaleY,
          (p.z - cz) * scaleXZ
        )
    )

    const box = new THREE.Box3().setFromPoints(normalized)
    const size = new THREE.Vector3()
    box.getSize(size)
    const maxDim = Math.max(size.x, size.y, size.z, 0.01)
    const fitScale = 2 / maxDim
    normalized = normalized.map((p) => p.clone().multiplyScalar(fitScale))

    const curve = new THREE.CatmullRomCurve3(normalized, false)
    const tubeRadius = 0.04
    const tubeSegments = Math.max(64, normalized.length)
    const tubeGeometry = new THREE.TubeGeometry(curve, tubeSegments, tubeRadius, 8, false)
    const color = new THREE.Color(strokeColor)
    const material = new THREE.MeshLambertMaterial({
      color,
      side: THREE.DoubleSide,
    })
    const tube = new THREE.Mesh(tubeGeometry, material)
    lineRef.current = tube as unknown as THREE.Line

    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0x0b0e11)
    scene.add(tube)
    const ambient = new THREE.AmbientLight(0x404060, 0.9)
    scene.add(ambient)
    const dirLight = new THREE.DirectionalLight(0xffffff, 0.8)
    dirLight.position.set(2, 4, 2)
    scene.add(dirLight)
    sceneRef.current = scene

    const w = container.clientWidth || 400
    const h = height || container.clientHeight || 280
    const camera = new THREE.PerspectiveCamera(45, w / h, 0.01, 100)
    const dist = 2.2
    camera.position.set(dist * 0.8, dist * 1.2, dist * 0.8)
    camera.lookAt(0, 0, 0)
    camera.updateProjectionMatrix()
    cameraRef.current = camera

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false })
    renderer.setSize(w, h)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    container.appendChild(renderer.domElement)
    rendererRef.current = renderer

    const animate = () => {
      frameRef.current = requestAnimationFrame(animate)
      renderer.render(scene, camera)
    }
    animate()

    const onResize = () => {
      const c = containerRef.current
      if (!c || !rendererRef.current || !cameraRef.current) return
      const w = c.clientWidth || 400
      const h = height || c.clientHeight || 280
      rendererRef.current.setSize(w, h)
      cameraRef.current.aspect = w / h
      cameraRef.current.updateProjectionMatrix()
    }
    window.addEventListener('resize', onResize)

    return () => {
      window.removeEventListener('resize', onResize)
      cancelAnimationFrame(frameRef.current)
      if (rendererRef.current?.domElement?.parentNode) {
        rendererRef.current.domElement.parentNode.removeChild(rendererRef.current.domElement)
      }
      rendererRef.current?.dispose()
      rendererRef.current = null
      lineRef.current?.geometry?.dispose()
      ;(lineRef.current?.material as THREE.Material)?.dispose()
      lineRef.current = null
      sceneRef.current = null
      cameraRef.current = null
    }
  }, [pathPoints, segmentProfile, strokeColor, height])

  return (
    <div
      ref={containerRef}
      className="gpx-segment-3d-view"
      style={{ height: height ? `${height}px` : '100%' }}
      aria-label="Vue 3D du segment avec relief"
    />
  )
}
