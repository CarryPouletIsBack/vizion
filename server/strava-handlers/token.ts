import type { VercelRequest, VercelResponse } from '@vercel/node'

export async function tokenHandler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' })
  }
  const { code } = (req.body || {}) as { code?: string }
  if (!code) {
    return res.status(400).json({ error: 'Missing code parameter' })
  }
  const clientId = process.env.STRAVA_CLIENT_ID
  const clientSecret = process.env.STRAVA_CLIENT_SECRET
  if (!clientId || !clientSecret) {
    return res.status(500).json({ error: 'Strava credentials not configured' })
  }
  try {
    const tokenResponse = await fetch('https://www.strava.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        grant_type: 'authorization_code',
      }),
    })
    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text()
      return res.status(tokenResponse.status).json({ error: errorText })
    }
    const tokenData = await tokenResponse.json()
    return res.status(200).json({
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token,
      expires_at: tokenData.expires_at,
      athlete: tokenData.athlete,
    })
  } catch (error) {
    console.error('Erreur lors de l\'échange du token Strava:', error)
    return res.status(500).json({ error: 'Token exchange failed' })
  }
}
