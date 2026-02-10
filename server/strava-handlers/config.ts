import type { VercelRequest, VercelResponse } from '@vercel/node'

export async function configHandler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method Not Allowed' })
  }
  const clientId = process.env.STRAVA_CLIENT_ID
  if (!clientId || clientId.trim() === '') {
    return res.status(500).json({
      error: 'STRAVA_CLIENT_ID not configured',
      message: 'Veuillez configurer STRAVA_CLIENT_ID dans les variables d\'environnement Vercel (Settings > Environment Variables)',
    })
  }
  return res.status(200).json({ client_id: clientId })
}
