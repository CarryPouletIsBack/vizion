import type { VercelRequest, VercelResponse } from '@vercel/node'

/**
 * Conseils de préparation personnalisés par l'IA à partir des données .fit des utilisateurs.
 * L'IA "apprend" des sorties renseignées (distance, D+, durée) pour donner des recommandations adaptées.
 * POST /api/preparation/advice
 * Body: { course: { distanceKm, elevationGain, name? }, fitActivities: Array<{ distanceKm?, durationSec?, ascentM?, fileName? }>, analysisSummary? }
 */

type FitActivityInput = {
  distanceKm?: number | null
  durationSec?: number | null
  ascentM?: number | null
  fileName?: string | null
}

type AdviceBody = {
  course: { distanceKm: number; elevationGain: number; name?: string }
  fitActivities: FitActivityInput[]
  analysisSummary?: string | null
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
      temperature: 0.3,
      max_tokens: 600,
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

function buildPrompt(body: AdviceBody): string {
  const { course, fitActivities, analysisSummary } = body
  const lines: string[] = [
    `Tu es un coach trail expert. Un coureur prépare une course et a renseigné ses sorties (fichiers .fit) pour que tu analyses sa préparation.`,
    ``,
    `**Course à préparer** : ${course.name || 'Course'} – ${course.distanceKm} km, ${Math.round(course.elevationGain)} m D+.`,
    ``,
    `**Sorties du coureur (données .fit qu'il a importées)** :`,
  ]
  if (fitActivities.length === 0) {
    lines.push(`Aucune sortie renseignée pour l'instant.`)
  } else {
    fitActivities.forEach((a, i) => {
      const km = a.distanceKm != null ? `${a.distanceKm.toFixed(1)} km` : '?'
      const dplus = a.ascentM != null ? `${Math.round(a.ascentM)} m D+` : '?'
      const dur = a.durationSec != null ? `${Math.round(a.durationSec / 60)} min` : '?'
      const name = a.fileName || `Sortie ${i + 1}`
      lines.push(`- ${name} : ${km}, ${dplus}, ${dur}`)
    })
  }
  lines.push(``)
  if (analysisSummary) {
    lines.push(`**Résumé de l'analyse Trackali** : ${analysisSummary}`)
    lines.push(``)
  }
  lines.push(
    `En t'appuyant UNIQUEMENT sur ces données .fit et la course cible, rédige un court paragraphe de conseils personnalisés (3 à 5 phrases) :`,
    `- Compare objectivement ses sorties à la course (distance, D+).`,
    `- Dis ce qui est déjà bien et ce qu'il pourrait améliorer.`,
    `- Sois encourageant et précis. Pas de liste à puces, un texte fluide.`,
    `Réponds en français, directement avec le paragraphe, sans préambule ni "Voici mes conseils".`
  )
  return lines.join('\n')
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' })
  }

  const body = req.body as AdviceBody
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
      message: 'Définir MISTRAL_API_KEY dans Vercel pour activer les conseils par l\'IA.',
    })
  }

  try {
    const prompt = buildPrompt(body)
    const advice = await callMistralApi(prompt)
    res.setHeader('Cache-Control', 'no-store')
    return res.status(200).json({ advice: advice.trim() })
  } catch (err) {
    console.error('Preparation advice:', err)
    return res.status(500).json({
      error: 'Erreur lors de l\'appel à l\'IA',
      message: err instanceof Error ? err.message : 'Erreur inconnue',
    })
  }
}
