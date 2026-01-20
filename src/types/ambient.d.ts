declare module '@observablehq/runtime'
declare module '../vendor/world-map/index.js'
declare module '../vendor/zoom-to-bounding-box/index.js'
declare module 'd3'
declare module 'd3-geo'
declare module 'd3-tile'
declare module 'react-simple-maps'

declare namespace GeoJSON {
  // Simplification pour usage local
  type FeatureCollection = any
  type Feature = any
}
