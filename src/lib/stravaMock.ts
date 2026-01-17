import type { StravaActivity } from '../types/strava'

// Jeu d'activités fictives sur 6 semaines pour le dev local
export const mockActivities: StravaActivity[] = [
  { id: 'a1', date: '2025-12-02', distanceKm: 12, elevationGain: 420, movingTimeSec: 4200 },
  { id: 'a2', date: '2025-12-04', distanceKm: 9, elevationGain: 260, movingTimeSec: 3200 },
  { id: 'a3', date: '2025-12-07', distanceKm: 18, elevationGain: 720, movingTimeSec: 5400 },
  { id: 'a4', date: '2025-12-10', distanceKm: 14, elevationGain: 510, movingTimeSec: 4300 },
  { id: 'a5', date: '2025-12-13', distanceKm: 22, elevationGain: 980, movingTimeSec: 7200 },
  { id: 'a6', date: '2025-12-17', distanceKm: 10, elevationGain: 320, movingTimeSec: 3500 },
  { id: 'a7', date: '2025-12-19', distanceKm: 16, elevationGain: 610, movingTimeSec: 5000 },
  { id: 'a8', date: '2025-12-22', distanceKm: 24, elevationGain: 1050, movingTimeSec: 7600 },
  { id: 'a9', date: '2025-12-24', distanceKm: 8, elevationGain: 210, movingTimeSec: 2800 },
  { id: 'a10', date: '2025-12-27', distanceKm: 30, elevationGain: 1250, movingTimeSec: 9800 },
  { id: 'a11', date: '2025-12-30', distanceKm: 12, elevationGain: 360, movingTimeSec: 4000 },
  { id: 'a12', date: '2026-01-03', distanceKm: 20, elevationGain: 900, movingTimeSec: 6900 },
  { id: 'a13', date: '2026-01-06', distanceKm: 10, elevationGain: 280, movingTimeSec: 3300 },
  { id: 'a14', date: '2026-01-09', distanceKm: 15, elevationGain: 540, movingTimeSec: 4700 },
  { id: 'a15', date: '2026-01-12', distanceKm: 26, elevationGain: 1180, movingTimeSec: 8400 },
  { id: 'a16', date: '2026-01-14', distanceKm: 9, elevationGain: 230, movingTimeSec: 2900 },
  { id: 'a17', date: '2026-01-16', distanceKm: 17, elevationGain: 680, movingTimeSec: 5200 },
]

export function getMockActivities(): StravaActivity[] {
  return mockActivities
}
