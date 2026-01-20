import type { VercelRequest, VercelResponse } from '@vercel/node'

/**
 * Endpoint API pour récupérer la configuration Strava (client_id uniquement)
 * Sécurisé : ne retourne que le client_id, jamais le client_secret
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method Not Allowed' })
  }

  const clientId = process.env.STRAVA_CLIENT_ID

  if (!clientId || clientId.trim() === '') {
    console.error('STRAVA_CLIENT_ID not configured in Vercel environment variables')
    return res.status(500).json({ 
      error: 'STRAVA_CLIENT_ID not configured',
      message: 'Veuillez configurer STRAVA_CLIENT_ID dans les variables d\'environnement Vercel (Settings > Environment Variables)'
    })
  }

  // Retourner uniquement le client_id (sécurisé)
  return res.status(200).json({ client_id: clientId })
}
