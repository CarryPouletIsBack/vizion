/**
 * Moteur physique de simulation de course trail (3 étages).
 * S'appuie sur : physique du terrain (pente), météo (boue, froid, chaleur, nuit), physiologie (fatigue).
 * Utilise weatherData quand disponible (réponse API /api/weather avec weatherData).
 */

/** Segment GPX : distance en mètres, dénivelé en mètres, altitude moyenne en mètres */
export type SegmentGpx = {
  distance: number
  denivele: number
  altitude: number
}

/** Structure weatherData renvoyée par l'API météo (Open-Meteo) */
export type WeatherData = {
  current?: {
    time: Date
    temp?: number
    feels_like?: number
    is_day?: number
    precip?: number
    wind?: number
    gusts?: number
  }
  hourly: {
    time: Date[] | number[]
    temperature_2m: number[]
    apparent_temperature?: number[]
    precipitation?: number[]
    snowfall?: number[]
    rain?: number[]
    wind_speed_10m?: number[]
    wind_gusts_10m?: number[]
    soil_moisture?: number[]
    freezing_level?: number[]
  }
  daily?: {
    sunrise?: Date[]
    sunset?: Date[]
    daylight_duration?: number[]
  }
}

/** Conditions météo à un instant T (pour un segment) */
export type ConditionsMeteo = {
  temp: number
  pluie: number
  boue: number
  isoZero: number
  nuit: boolean
}

/** Résultat détaillé de la simulation (pour affichage "F1" et variantes de texte) */
export type SimulationDetail = {
  /** Temps perdu à cause du terrain gras (minutes) */
  impactBoueMin: number
  /** Temps perdu à cause de la chaleur (minutes) */
  impactChaleurMin: number
  /** Temps perdu à cause du froid/neige (minutes) */
  impactFroidMin: number
  /** Conditions au départ */
  conditionsDepart: ConditionsMeteo
  /** Conditions à l'arrivée estimée */
  conditionsArrivee: ConditionsMeteo
  /** Messages prêts pour l'UI (variantes de texte) */
  messages: string[]
}

export type SimulationResult = {
  tempsTotalSecondes: number
  tempsTotalHeures: number
  tempsTotalFormatted: string
  heureArriveeEstimee: Date
  details: SimulationDetail
}

/** Options du moteur (coefficients ajustables) */
export type PhysicsEngineOptions = {
  /** Perte de vitesse par km parcouru (fatigue), ex. 0.005 = 0.5% par km */
  fatiguePerKm?: number
  /** Vitesse minimum (ne pas descendre en dessous), en ratio de la vitesse de base */
  fatigueMinRatio?: number
  /** Activer le malus nuit (-10%) */
  useNuit?: boolean
  /** Seuil soil_moisture au-delà duquel on applique le malus boue */
  seuilBoue?: number
}

const DEFAULT_OPTIONS: Required<PhysicsEngineOptions> = {
  fatiguePerKm: 0.005,
  fatigueMinRatio: 0.5,
  useNuit: true,
  seuilBoue: 0.35,
}

// --- 1. PHYSIQUE DU TERRAIN (GAP) ---

/**
 * Facteur de vitesse selon la pente (approximation type Minetti).
 * 0% = 1.0 ; montée = ralentissement ; descente = accélération puis freinage si trop raide.
 */
export function getFacteurPente(penteEnPourcent: number): number {
  if (penteEnPourcent > 40) return 0.3
  if (penteEnPourcent > 20) return 0.5
  if (penteEnPourcent > 10) return 0.7
  if (penteEnPourcent > 0) return 0.9
  if (penteEnPourcent === 0) return 1.0
  if (penteEnPourcent > -5) return 1.1
  if (penteEnPourcent > -15) return 1.2
  if (penteEnPourcent > -25) return 1.0
  return 0.7
}

// --- 2. HELPER MÉTÉO ---

/**
 * Retourne les conditions météo à l'instant dateSimulee.
 * Si weatherData est absent, retourne des valeurs par défaut (pas de malus météo).
 */
export function getConditionsMeteo(dateSimulee: Date, weatherData: WeatherData | null): ConditionsMeteo {
  const defaults: ConditionsMeteo = {
    temp: 15,
    pluie: 0,
    boue: 0,
    isoZero: 3000,
    nuit: dateSimulee.getHours() < 6 || dateSimulee.getHours() >= 21,
  }
  if (!weatherData?.hourly?.time?.length) return defaults

  const times = weatherData.hourly.time
  const toMs = (t: Date | number) => (t instanceof Date ? t.getTime() : t * 1000)
  const targetMs = dateSimulee.getTime()
  const oneHourMs = 3600 * 1000

  let index = times.findIndex((t) => Math.abs(toMs(t) - targetMs) < oneHourMs)
  if (index === -1) index = times.length - 1
  if (index < 0) return defaults

  const temp = weatherData.hourly.temperature_2m?.[index] ?? defaults.temp
  const boue = weatherData.hourly.soil_moisture?.[index] ?? 0
  const isoZero = weatherData.hourly.freezing_level?.[index] ?? 3000
  const pluie = weatherData.hourly.precipitation?.[index] ?? 0
  const hour = dateSimulee.getHours()
  const nuit = hour < 6 || hour >= 21

  return { temp, pluie, boue, isoZero, nuit }
}

// --- 3. CONVERSION PROFIL → SEGMENTS ---

/**
 * Transforme le profil d'élévation (distance km, altitude m) en segments pour le moteur.
 */
export function profileToSegments(profile: Array<[number, number]>): SegmentGpx[] {
  if (profile.length < 2) return []
  const segments: SegmentGpx[] = []
  for (let i = 1; i < profile.length; i++) {
    const [d0, e0] = profile[i - 1]
    const [d1, e1] = profile[i]
    const distanceKm = d1 - d0
    const distanceM = distanceKm * 1000
    const denivele = e1 - e0
    const altitude = (e0 + e1) / 2
    if (distanceM <= 0) continue
    segments.push({ distance: distanceM, denivele, altitude })
  }
  return segments
}

// --- 4. SIMULATION PRINCIPALE ---

/**
 * Simule la course segment par segment avec terrain, météo et fatigue.
 * Retourne le temps total et des détails pour affichage (impact boue, conditions, messages).
 */
export function simulerCourse(
  segments: SegmentGpx[],
  weatherData: WeatherData | null,
  vitessePlatCoureurKmH: number,
  heureDepart: Date,
  options: PhysicsEngineOptions = {}
): SimulationResult {
  const opts = { ...DEFAULT_OPTIONS, ...options }
  let tempsTotalSecondes = 0
  let distanceParcourueM = 0
  let currentTime = new Date(heureDepart)

  let perteTempsBoue = 0
  let perteTempsChaleur = 0
  let perteTempsFroid = 0

  const vitesseBaseMS = vitessePlatCoureurKmH / 3.6

  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i]
    let pente = 0
    if (segment.distance > 0) {
      pente = (segment.denivele / segment.distance) * 100
    }

    const facteurPente = getFacteurPente(pente)
    const vitesseActuelle = vitesseBaseMS * facteurPente

    const conditions = getConditionsMeteo(currentTime, weatherData)

    let malusGlobal = 1.0

    // 1. Boue (soil moisture)
    if (weatherData && conditions.boue > opts.seuilBoue) {
      const malusBoue = Math.max(0.85, 1 - (conditions.boue - 0.3) * 0.3)
      malusGlobal *= malusBoue
      const tempsAvecMalus = segment.distance / (vitesseActuelle * malusBoue)
      const tempsSansMalus = segment.distance / vitesseActuelle
      perteTempsBoue += tempsAvecMalus - tempsSansMalus
    }

    // 2. Froid / neige (altitude > isotherme 0°C - 200 m)
    if (segment.altitude > conditions.isoZero - 200) {
      malusGlobal *= 0.8
      perteTempsFroid += (segment.distance / (vitesseActuelle * 0.8)) - segment.distance / vitesseActuelle
    }

    // 3. Chaleur (> 18°C)
    if (conditions.temp > 18) {
      const malusChaleur = Math.max(0.7, 1 - (conditions.temp - 18) * 0.01)
      malusGlobal *= malusChaleur
      perteTempsChaleur +=
        segment.distance / (vitesseActuelle * malusChaleur) - segment.distance / vitesseActuelle
    }

    // 4. Nuit
    if (opts.useNuit && conditions.nuit) {
      malusGlobal *= 0.9
    }

    // 5. Fatigue
    const facteurFatigue = Math.max(opts.fatigueMinRatio, 1 - (distanceParcourueM / 1000) * opts.fatiguePerKm)
    const vitesseFinale = vitesseActuelle * malusGlobal * facteurFatigue
    const tempsSegment = segment.distance / vitesseFinale

    tempsTotalSecondes += tempsSegment
    distanceParcourueM += segment.distance
    currentTime = new Date(currentTime.getTime() + tempsSegment * 1000)
  }

  const tempsTotalHeures = tempsTotalSecondes / 3600
  const h = Math.floor(tempsTotalHeures)
  const m = Math.round((tempsTotalHeures - h) * 60)
  const tempsTotalFormatted = `${h}h ${m}min`

  const conditionsDepart = getConditionsMeteo(heureDepart, weatherData)
  const conditionsArrivee = getConditionsMeteo(currentTime, weatherData)

  const messages: string[] = []
  const boueMin = Math.round(perteTempsBoue / 60)
  const chaleurMin = Math.round(perteTempsChaleur / 60)
  const froidMin = Math.round(perteTempsFroid / 60)
  if (boueMin > 0) {
    messages.push(`${boueMin} min de plus prévues (terrain gras, indice boue élevé).`)
  }
  if (chaleurMin > 0) {
    messages.push(`Environ ${chaleurMin} min de plus à cause de la chaleur (ressenti).`)
  }
  if (froidMin > 0) {
    messages.push(`${froidMin} min de plus (secteurs neige/verglas possibles).`)
  }
  if (conditionsDepart.nuit && conditionsArrivee.nuit && messages.length === 0) {
    messages.push('Départ et arrivée de nuit : prévoir frontale et prudence.')
  }
  if (conditionsDepart.temp > 25 || conditionsArrivee.temp > 25) {
    messages.push('Températures élevées : prévoir eau et sel.')
  }

  return {
    tempsTotalSecondes,
    tempsTotalHeures,
    tempsTotalFormatted,
    heureArriveeEstimee: currentTime,
    details: {
      impactBoueMin: Math.round(perteTempsBoue / 60),
      impactChaleurMin: Math.round(perteTempsChaleur / 60),
      impactFroidMin: Math.round(perteTempsFroid / 60),
      conditionsDepart,
      conditionsArrivee,
      messages,
    },
  }
}

/**
 * Estime le temps de course en utilisant le moteur physique quand profil + weatherData sont dispo,
 * sinon fallback sur une estimation globale (distance + D+).
 * Utile pour brancher dans l'UI sans casser le flux actuel.
 */
export function estimateTimeWithPhysics(
  profile: Array<[number, number]>,
  weatherData: WeatherData | null,
  vitessePlatCoureurKmH: number,
  heureDepart: Date,
  options?: PhysicsEngineOptions
): SimulationResult | null {
  const segments = profileToSegments(profile)
  if (segments.length === 0) return null
  return simulerCourse(segments, weatherData, vitessePlatCoureurKmH, heureDepart, options)
}
