// @ts-nocheck
import { useEffect, useRef } from 'react'
import { Inspector, Runtime } from '@observablehq/runtime'
import notebook from '../vendor/zoom-to-bounding-box/index.js'

import './WorldMapZoom.css'

export default function WorldMapZoom() {
  const chartRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const runtime = new Runtime()
    runtime.module(notebook, (name) => {
      if (name === 'chart') return new Inspector(chartRef.current!)
      return null
    })
    return () => runtime.dispose()
  }, [])

  return <div ref={chartRef} className="world-map-zoom" />
}
