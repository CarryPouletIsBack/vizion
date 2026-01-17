// @ts-nocheck
import { useEffect, useMemo, useRef, useState } from 'react'
import * as d3 from 'd3'
import { tile as d3Tile } from 'd3-tile'

import './WorldMapTiles.css'

type TileData = {
  scale: number
  translate: [number, number]
  tiles: Array<[number, number, number]>
}

const TILE_SIZE = 256
const DEFAULT_ZOOM = 2

export default function WorldMapTiles() {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [size, setSize] = useState({ width: 0, height: 0 })

  useEffect(() => {
    const element = containerRef.current
    if (!element) return

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect
        setSize({ width, height })
      }
    })

    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  const tileData: TileData | null = useMemo(() => {
    if (!size.width || !size.height) return null

    // Projection Web Mercator centrée pour une vue monde.
    const worldScale = (TILE_SIZE * Math.pow(2, DEFAULT_ZOOM)) / (2 * Math.PI)
    const projection = d3
      .geoMercator()
      .scale(worldScale)
      .translate([size.width / 2, size.height / 2])

    const tile = d3Tile().size([size.width, size.height])
    const tiles = tile
      .scale(projection.scale() * 2 * Math.PI)
      .translate(projection([0, 0]))

    return {
      scale: tiles.scale,
      translate: tiles.translate,
      tiles: tiles,
    }
  }, [size.height, size.width])

  return (
    <div className="world-map" ref={containerRef}>
      {tileData?.tiles?.length ? (
        <svg className="world-map__svg" width={size.width} height={size.height}>
          <g
            transform={`translate(${tileData.translate[0]}, ${tileData.translate[1]}) scale(${tileData.scale})`}
          >
            {tileData.tiles.map(([x, y, z]) => (
              <image
                key={`${x}-${y}-${z}`}
                href={`https://tile.openstreetmap.org/${z}/${x}/${y}.png`}
                x={x * TILE_SIZE}
                y={y * TILE_SIZE}
                width={TILE_SIZE}
                height={TILE_SIZE}
              />
            ))}
          </g>
        </svg>
      ) : null}
    </div>
  )
}
