// @ts-nocheck
import { useEffect, useRef } from 'react'
import { Inspector, Runtime } from '@observablehq/runtime'

import define from '../vendor/world-map/index.js'
import './WorldMapObservable.css'

export default function WorldMapObservable() {
  const containerRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!containerRef.current) return

    const runtime = new Runtime()
    const main = runtime.module(define, (name) => {
      if (name === 'map') {
        return new Inspector(containerRef.current!)
      }
      return null
    })

    return () => {
      main?.dispose?.()
      runtime.dispose()
    }
  }, [])

  return <div ref={containerRef} className="world-map-observable" />
}
