import type { VercelRequest, VercelResponse } from '@vercel/node'

/**
 * Affine l'estimation du simulateur avec un modèle IA (Mistral API).
 * Retourne une fourchette de temps en minutes pour un calcul plus précis.
 * POST /api/simulator/refine
 * Body: { distanceKm, elevationGain, metricsSummary?, currentEstimate, params? }
 * Réponse: { suggestedMinMinutes: number, suggestedMaxMinutes: number }
 */

type RefineBody = {
  distanceKm: number
  elevationGain: number
  metricsSummary?: string | null
  currentEstimate: {
    rangeFormatted: string
    formatted: string
    basePace: number
    finalPace: number
    totalMinutes?: number
  }
  params?: {
    fitnessLevel?: number
    technicalIndex?: string
    enduranceIndex?: string
    refuelStops?: number
    temperature?: number
  }
}

function buildPrompt(body: RefineBody): string {
  const { distanceKm, elevationGain, metricsSummary, currentEstimate, params } = body
  const lines = [
    `Tu es un coach trail expert. Donne UNIQUEMENT une fourchette de temps réaliste pour cette course, sous forme d'objet JSON.`,
    ``,
    `**Course** : ${distanceKm} km, ${elevationGain} m D+.`,
    `**Estimation actuelle du simulateur** : ${currentEstimate.rangeFormatted} (temps central : ${currentEstimate.formatted}).`,
    `Allure de base : ${currentEstimate.basePace.toFixed(1)} min/km, allure ajustée : ${currentEstimate.finalPace.toFixed(1)} min/km.`,
  ]
  if (metricsSummary) lines.push(``, `**Profil coureur** : ${metricsSummary}`)
  if (params) lines.push(``, `**Paramètres** : forme ${params.fitnessLevel ?? '-'}%, technicité ${params.technicalIndex ?? '-'}, endurance ${params.enduranceIndex ?? '-'}, ravitaillements ${params.refuelStops ?? '-'}, température ${params.temperature ?? '-'}°C.`)
  lines.push(
    ``,
    `Réponds UNIQUEMENT avec un JSON valide, sans texte avant ou après, avec exactement ces deux clés (nombres entiers, temps total de course en minutes) :`,
    `{"suggestedMinMinutes": <nombre>, "suggestedMaxMinutes": <nombre>}`,
    `Exemple pour 28h-32h : {"suggestedMinMinutes": 1680, "suggestedMaxMinutes": 1920}`
  )
  return lines.join('\n')
}

function parseJsonFromResponse(content: string): { suggestedMinMinutes: number; suggestedMaxMinutes: number } | null {
  const trimmed = content.trim()
  const jsonMatch = trimmed.match(/\{[\s\S]*"suggestedMinMinutes"[\s\S]*"suggestedMaxMinutes"[\s\S]*\}/) || trimmed.match(/\{[\s\S]*\}/)
  if (!jsonMatch) return null
  try {
    const parsed = JSON.parse(jsonMatch[0]) as { suggestedMinMinutes?: number; suggestedMaxMinutes?: number }
    const min = typeof parsed.suggestedMinMinutes === 'number' ? Math.round(parsed.suggestedMinMinutes) : null
    const max = typeof parsed.suggestedMaxMinutes === 'number' ? Math.round(parsed.suggestedMaxMinutes) : null
    if (min == null || max == null || min < 0 || max < 0 || min > max) return null
    return { suggestedMinMinutes: min, suggestedMaxMinutes: max }
  } catch {
    return null
  }
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
      temperature: 0.2,
      max_tokens: 150,
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

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' })
  }

  const body = req.body as RefineBody
  if (
    !body ||
    typeof body.distanceKm !== 'number' ||
    typeof body.elevationGain !== 'number' ||
    !body.currentEstimate ||
    typeof body.currentEstimate.rangeFormatted !== 'string'
  ) {
    return res.status(400).json({
      error: 'Body invalide',
      message: 'Requiert distanceKm, elevationGain, currentEstimate.rangeFormatted',
    })
  }

  if (!process.env.MISTRAL_API_KEY) {
    return res.status(503).json({
      error: 'IA non configurée',
      message: 'Définir MISTRAL_API_KEY (Vercel) ou utiliser Ollama en local (voir README).',
    })
  }

  try {
    const prompt = buildPrompt(body)
    const content = await callMistralApi(prompt)
    const refined = parseJsonFromResponse(content)
    if (!refined) {
      return res.status(422).json({
        error: 'Réponse IA invalide',
        message: 'Le modèle n\'a pas renvoyé un JSON avec suggestedMinMinutes et suggestedMaxMinutes.',
      })
    }
    res.setHeader('Cache-Control', 'no-store')
    return res.status(200).json(refined)
  } catch (err) {
    console.error('Refine simulator:', err)
    return res.status(500).json({
      error: 'Erreur lors de l\'appel au modèle',
      message: err instanceof Error ? err.message : 'Erreur inconnue',
    })
  }
}
