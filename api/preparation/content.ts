import type { VercelRequest, VercelResponse } from '@vercel/node'

/**
 * Génère tout le contenu texte de la section "Ma préparation" via l'IA.
 * Une seule génération, à mettre en cache côté client (ex. 7 jours).
 * POST /api/preparation/content
 * Body: { course, fitActivities, metricsSummary?, readiness?, next4WeeksGoals? }
 * Réponse: { summary, coachVerdict, stateSublabel, next4WeeksSummary, immediateActions, secondaryActions, projectionIfContinues, projectionIfFollows }
 */

type FitActivityInput = {
  distanceKm?: number | null
  durationSec?: number | null
  ascentM?: number | null
  fileName?: string | null
}

type ContentBody = {
  course: { distanceKm: number; elevationGain: number; name?: string }
  fitActivities: FitActivityInput[]
  metricsSummary?: string | null
  readiness?: 'ready' | 'needs_work' | 'risk' | null
  next4WeeksGoals?: {
    volumeKm: { min: number; max: number }
    dPlus: { min: number; max: number }
    frequency: number
    longRunHours: number
  } | null
}

export type PreparationContentResponse = {
  summary: string
  coachVerdict: string
  stateSublabel: string
  next4WeeksSummary: string
  immediateActions: string[]
  secondaryActions: string[]
  projectionIfContinues: string
  projectionIfFollows: string
  segmentIntro?: string
}

async function callMistralApi(prompt: string): Promise<string> {
  const apiKey = process.env.MISTRAL_API_KEY
  if (!apiKey) throw new Error('MISTRAL_API_KEY non configurée')
  const res = await fetch('https://api.mistral.ai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: process.env.MISTRAL_SIMULATOR_MODEL || 'mistral-small-latest',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.35,
      max_tokens: 1200,
    }),
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Mistral API: ${res.status} ${err}`)
  }
  const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> }
  const content = data?.choices?.[0]?.message?.content?.trim()
  if (!content) throw new Error('Réponse Mistral vide')
  return content
}

function buildPrompt(body: ContentBody): string {
  const { course, fitActivities, metricsSummary, readiness, next4WeeksGoals } = body
  const lines: string[] = [
    `Tu es un coach trail expert. Génère TOUT le contenu texte pour la section "Ma préparation" d'une app de préparation trail.`,
    ``,
    `**Course** : ${course.name || 'Course'} – ${course.distanceKm} km, ${Math.round(course.elevationGain)} m D+.`,
    ``,
    `**Sorties du coureur (.fit importées)** :`,
  ]
  if (fitActivities.length === 0) {
    lines.push(`Aucune sortie renseignée.`)
  } else {
    fitActivities.forEach((a, i) => {
      const km = a.distanceKm != null ? `${a.distanceKm.toFixed(1)} km` : '?'
      const dplus = a.ascentM != null ? `${Math.round(a.ascentM)} m D+` : '?'
      const dur = a.durationSec != null ? `${Math.round(a.durationSec / 60)} min` : '?'
      lines.push(`- ${a.fileName || `Sortie ${i + 1}`} : ${km}, ${dplus}, ${dur}`)
    })
  }
  if (metricsSummary) lines.push(``, `**Contexte analyse** : ${metricsSummary}`)
  if (readiness) lines.push(``, `**Niveau actuel** : ${readiness === 'ready' ? 'Prêt' : readiness === 'needs_work' ? 'À renforcer' : 'Risque'}.`)
  if (next4WeeksGoals) {
    lines.push(
      ``,
      `**Objectifs 4 sem (chiffres)** : ${next4WeeksGoals.volumeKm.min}–${next4WeeksGoals.volumeKm.max} km/sem, ${next4WeeksGoals.dPlus.min}–${next4WeeksGoals.dPlus.max} m D+/sem, ${next4WeeksGoals.frequency} sorties/sem, 1 sortie > ${next4WeeksGoals.longRunHours}h.`
    )
  }
  lines.push(
    ``,
    `Réponds UNIQUEMENT avec un JSON valide (pas de texte avant/après), avec exactement ces clés :`,
    `- summary : une phrase de résumé pour le bloc "État de préparation" (ton encourageant, compare ses sorties à la course).`,
    `- coachVerdict : une phrase pour "Verdict du Coach" (conseil personnalisé, 1-2 phrases).`,
    `- stateSublabel : une courte phrase sous le titre d'état (ex. "Attention : préparation insuffisante" ou "Quelques ajustements recommandés").`,
    `- next4WeeksSummary : une phrase qui résume l'enjeu des 4 prochaines semaines (ex. "Si ces objectifs sont atteints, ton état passera à À renforcer.").`,
    `- immediateActions : tableau de 2 à 4 chaînes (priorités immédiates, phrases courtes).`,
    `- secondaryActions : tableau de 1 à 3 chaînes (recommandations secondaires).`,
    `- projectionIfContinues : une courte phrase pour "Si tu continues ainsi" (ex. "Sans changement, tu resteras en Risque à M-1.").`,
    `- projectionIfFollows : une courte phrase pour "Si tu suis les objectifs" (ex. "En suivant les objectifs, tu peux passer à Prêt (partiellement) à M-1.").`,
    `- segmentIntro (optionnel) : une phrase d'intro pour "Préparation par segment" si pertinent.`,
    ``,
    `Format : {"summary":"...","coachVerdict":"...","stateSublabel":"...","next4WeeksSummary":"...","immediateActions":["...","..."],"secondaryActions":["..."],"projectionIfContinues":"...","projectionIfFollows":"..."}`,
    `Tout en français, ton coach bienveillant et précis.`
  )
  return lines.join('\n')
}

function parseContentResponse(content: string): PreparationContentResponse | null {
  const trimmed = content.trim()
  const jsonMatch = trimmed.match(/\{[\s\S]*\}/)
  if (!jsonMatch) return null
  try {
    const parsed = JSON.parse(jsonMatch[0]) as Record<string, unknown>
    const summary = typeof parsed.summary === 'string' ? parsed.summary : ''
    const coachVerdict = typeof parsed.coachVerdict === 'string' ? parsed.coachVerdict : ''
    const stateSublabel = typeof parsed.stateSublabel === 'string' ? parsed.stateSublabel : ''
    const next4WeeksSummary = typeof parsed.next4WeeksSummary === 'string' ? parsed.next4WeeksSummary : ''
    const immediateActions = Array.isArray(parsed.immediateActions)
      ? parsed.immediateActions.filter((a): a is string => typeof a === 'string')
      : []
    const secondaryActions = Array.isArray(parsed.secondaryActions)
      ? parsed.secondaryActions.filter((a): a is string => typeof a === 'string')
      : []
    const projectionIfContinues = typeof parsed.projectionIfContinues === 'string' ? parsed.projectionIfContinues : ''
    const projectionIfFollows = typeof parsed.projectionIfFollows === 'string' ? parsed.projectionIfFollows : ''
    const segmentIntro = typeof parsed.segmentIntro === 'string' ? parsed.segmentIntro : undefined
    if (!summary && !coachVerdict) return null
    return {
      summary: summary || 'Analyse en cours.',
      coachVerdict: coachVerdict || '',
      stateSublabel: stateSublabel || '',
      next4WeeksSummary: next4WeeksSummary || '',
      immediateActions,
      secondaryActions,
      projectionIfContinues,
      projectionIfFollows,
      segmentIntro,
    }
  } catch {
    return null
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' })
  }

  const body = req.body as ContentBody
  if (
    !body?.course ||
    typeof body.course.distanceKm !== 'number' ||
    typeof body.course.elevationGain !== 'number' ||
    !Array.isArray(body.fitActivities)
  ) {
    return res.status(400).json({
      error: 'Body invalide',
      message: 'Requiert course: { distanceKm, elevationGain }, fitActivities: []',
    })
  }

  if (!process.env.MISTRAL_API_KEY) {
    return res.status(503).json({
      error: 'IA non configurée',
      message: 'Définir MISTRAL_API_KEY pour activer le contenu Ma préparation par l\'IA.',
    })
  }

  try {
    const prompt = buildPrompt(body)
    const content = await callMistralApi(prompt)
    const parsed = parseContentResponse(content)
    if (!parsed) {
      return res.status(422).json({
        error: 'Réponse IA invalide',
        message: 'Le modèle n\'a pas renvoyé un JSON valide avec les champs attendus.',
      })
    }
    res.setHeader('Cache-Control', 'no-store')
    return res.status(200).json(parsed)
  } catch (err) {
    console.error('Preparation content:', err)
    return res.status(500).json({
      error: 'Erreur lors de l\'appel à l\'IA',
      message: err instanceof Error ? err.message : 'Erreur inconnue',
    })
  }
}
