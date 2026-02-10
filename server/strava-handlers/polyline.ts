export function decodePolyline(encoded: string): Array<{ lat: number; lon: number }> {
  const points: Array<{ lat: number; lon: number }> = []
  let index = 0
  const len = encoded.length
  let lat = 0
  let lon = 0
  while (index < len) {
    let b
    let shift = 0
    let result = 0
    do {
      b = encoded.charCodeAt(index++) - 63
      result |= (b & 0x1f) << shift
      shift += 5
    } while (b >= 0x20)
    const dlat = (result & 1) !== 0 ? ~(result >> 1) : result >> 1
    lat += dlat
    shift = 0
    result = 0
    do {
      b = encoded.charCodeAt(index++) - 63
      result |= (b & 0x1f) << shift
      shift += 5
    } while (b >= 0x20)
    const dlon = (result & 1) !== 0 ? ~(result >> 1) : result >> 1
    lon += dlon
    points.push({ lat: lat * 1e-5, lon: lon * 1e-5 })
  }
  return points
}

export function calculateElevationGain(elevProfile: number[]): number {
  if (!elevProfile || elevProfile.length < 2) return 0
  let gain = 0
  for (let i = 1; i < elevProfile.length; i++) {
    const delta = elevProfile[i] - elevProfile[i - 1]
    if (delta > 0) gain += delta
  }
  return Math.round(gain)
}
