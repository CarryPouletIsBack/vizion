import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL ?? ''
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY ?? ''
const discordWebhookUrl = process.env.DISCORD_WEBHOOK_URL ?? ''

type FeedbackBody = {
  userId?: string | null
  courseId?: string | null
  courseName?: string | null
  activityId?: string | null
  rating: 'like' | 'dislike'
  tags?: string[]
  comment?: string | null
}

function buildDiscordMessage(payload: FeedbackBody): object {
  const emoji = payload.rating === 'like' ? '👍' : '👎'
  const ratingLabel = payload.rating === 'like' ? 'Like' : 'Dislike'
  const courseName = payload.courseName?.trim() || '_Parcours non précisé_'
  const tagsLine =
    Array.isArray(payload.tags) && payload.tags.length > 0
      ? payload.tags.join(', ')
      : '_Aucun tag_'
  const commentValue = payload.comment?.trim()
    ? `**${payload.comment.trim()}**`
    : '_Pas de commentaire_'

  return {
    username: 'Kaldera Bot',
    embeds: [
      {
        title: `${emoji} ${ratingLabel} sur le parcours`,
        description: `**${courseName}**`,
        color: payload.rating === 'like' ? 0x22c55e : 0xef4444,
        fields: [
          { name: '🏷️ Tags', value: tagsLine, inline: false },
          { name: '💬 Message', value: commentValue, inline: false },
        ],
        footer: { text: 'Kaldera · Retour utilisateur' },
        timestamp: new Date().toISOString(),
      },
    ],
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' })
  }

  const body = req.body as FeedbackBody
  const rating = body?.rating
  if (rating !== 'like' && rating !== 'dislike') {
    return res.status(400).json({
      error: 'Body invalide',
      message: 'Le champ "rating" doit être "like" ou "dislike".',
    })
  }

  const tags = Array.isArray(body.tags) ? body.tags : []
  const comment = typeof body.comment === 'string' ? body.comment : null
  const userId = body.userId && typeof body.userId === 'string' ? body.userId : null
  const courseId = body.courseId && typeof body.courseId === 'string' ? body.courseId : null
  const activityId = body.activityId && typeof body.activityId === 'string' ? body.activityId : null
  const courseName = body.courseName && typeof body.courseName === 'string' ? body.courseName : null

  // 1. Base de données (Supabase)
  if (supabaseUrl && supabaseAnonKey) {
    try {
      const supabase = createClient(supabaseUrl, supabaseAnonKey)
      const { error } = await supabase.from('user_feedback').insert({
        user_id: userId || null,
        course_id: courseId || null,
        activity_id: activityId || null,
        rating,
        tags,
        comment: comment || null,
      })
      if (error) {
        console.error('[api/feedback] Supabase insert error:', error)
        return res.status(500).json({
          error: 'Erreur lors de l’enregistrement du retour',
          message: error.message,
        })
      }
    } catch (err) {
      console.error('[api/feedback] Supabase error', err)
      return res.status(500).json({
        error: 'Erreur serveur',
        message: err instanceof Error ? err.message : 'Erreur inconnue',
      })
    }
  }

  // 2. Notification Discord
  if (discordWebhookUrl) {
    try {
      const discordPayload = buildDiscordMessage({
        userId,
        courseId,
        courseName,
        activityId,
        rating,
        tags,
        comment,
      })
      const discordRes = await fetch(discordWebhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(discordPayload),
      })
      if (!discordRes.ok) {
        console.warn('[api/feedback] Discord webhook failed:', discordRes.status, await discordRes.text())
      }
    } catch (err) {
      console.warn('[api/feedback] Discord webhook error', err)
    }
  }

  return res.status(200).json({ success: true })
}
