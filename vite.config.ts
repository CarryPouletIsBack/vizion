import { defineConfig } from 'vite'
import path from 'path'
import fs from 'fs/promises'
import os from 'os'
import { spawn } from 'child_process'
import { createHash } from 'crypto'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'

// Configuration Vite avec React + Tailwind, alignée sur le projet de référence.
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    {
      name: 'gpx-to-svg',
      configureServer(server) {
        server.middlewares.use('/api/gpx-to-svg', async (req, res) => {
          if (req.method !== 'POST') {
            res.statusCode = 405
            res.end('Method Not Allowed')
            return
          }

          const chunks: Buffer[] = []
          req.on('data', (chunk) => chunks.push(chunk))
          req.on('end', async () => {
            try {
              const body = Buffer.concat(chunks).toString('utf-8')
              const payload = JSON.parse(body) as { gpxText?: string; gpxName?: string }
              if (!payload.gpxText) {
                res.statusCode = 400
                res.end('Missing gpxText')
                return
              }

              const tmpDir = path.join(os.tmpdir(), 'vizion-gpx')
              await fs.mkdir(tmpDir, { recursive: true })

              const hash = createHash('sha1').update(payload.gpxText).digest('hex')
              const gpxFile = path.join(tmpDir, `${hash}.gpx`)
              const svgFile = path.join(tmpDir, `${hash}.svg`)
              await fs.writeFile(gpxFile, payload.gpxText, 'utf-8')

              const scriptPath = path.resolve(__dirname, './scripts/gpx_to_svg.py')
              await new Promise<void>((resolve, reject) => {
                const proc = spawn('python3', [scriptPath, gpxFile, svgFile])
                proc.on('error', reject)
                proc.on('close', (code) => {
                  if (code === 0) resolve()
                  else reject(new Error(`gpx_to_svg.py exited with ${code}`))
                })
              })

              const svgContent = await fs.readFile(svgFile, 'utf-8')
              let profile: Array<[number, number]> | undefined
              const profilePath = `${svgFile}.profile.json`
              try {
                const exists = await fs.stat(profilePath).catch(() => null)
                if (exists) {
                  profile = JSON.parse(await fs.readFile(profilePath, 'utf-8'))
                }
              } catch (e) {
                console.warn('Impossible de lire le profil GPX', e)
              }

              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify({ svg: svgContent, profile }))
            } catch (error) {
              res.statusCode = 500
              res.end('GPX conversion failed')
            }
          })
        })
      },
    },
      {
        name: 'strava-api',
        configureServer(server) {
          // Endpoint pour récupérer la config Strava (client_id uniquement)
          server.middlewares.use('/api/strava/config', async (req, res) => {
            if (req.method !== 'GET') {
              res.statusCode = 405
              res.end('Method Not Allowed')
              return
            }

            const clientId = process.env.STRAVA_CLIENT_ID || ''

            if (!clientId) {
              res.statusCode = 500
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify({ error: 'STRAVA_CLIENT_ID not configured' }))
              return
            }

            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ client_id: clientId }))
          })

          // Endpoint pour échanger le code OAuth
          server.middlewares.use('/api/strava/token', async (req, res) => {
            if (req.method !== 'POST') {
              res.statusCode = 405
              res.end('Method Not Allowed')
              return
            }

            const chunks: Buffer[] = []
            req.on('data', (chunk) => chunks.push(chunk))
            req.on('end', async () => {
              try {
                const body = Buffer.concat(chunks).toString('utf-8')
                const payload = JSON.parse(body) as { code: string }

                if (!payload.code) {
                  res.statusCode = 400
                  res.setHeader('Content-Type', 'application/json')
                  res.end(JSON.stringify({ error: 'Missing code parameter' }))
                  return
                }

                const clientId = process.env.STRAVA_CLIENT_ID || ''
                const clientSecret = process.env.STRAVA_CLIENT_SECRET || ''

                if (!clientId || !clientSecret) {
                  res.statusCode = 500
                  res.setHeader('Content-Type', 'application/json')
                  res.end(JSON.stringify({ error: 'Strava credentials not configured' }))
                  return
                }

                // Échanger le code contre un token via l'API Strava
                const tokenResponse = await fetch('https://www.strava.com/oauth/token', {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                  },
                  body: JSON.stringify({
                    client_id: clientId,
                    client_secret: clientSecret,
                    code: payload.code,
                    grant_type: 'authorization_code',
                  }),
                })

                if (!tokenResponse.ok) {
                  const errorText = await tokenResponse.text()
                  res.statusCode = tokenResponse.status
                  res.setHeader('Content-Type', 'application/json')
                  res.end(JSON.stringify({ error: errorText }))
                  return
                }

                const tokenData = (await tokenResponse.json()) as {
                  access_token: string
                  refresh_token: string
                  expires_at: number
                  athlete: {
                    id: number
                    username: string
                    firstname: string
                    lastname: string
                  }
                }
                res.setHeader('Content-Type', 'application/json')
                res.end(
                  JSON.stringify({
                    access_token: tokenData.access_token,
                    refresh_token: tokenData.refresh_token,
                    expires_at: tokenData.expires_at,
                    athlete: tokenData.athlete,
                  })
                )
              } catch (error) {
                res.statusCode = 500
                res.setHeader('Content-Type', 'application/json')
                res.end(JSON.stringify({ error: 'Token exchange failed' }))
              }
          })
        })

        // Endpoint pour récupérer les activités Strava
        server.middlewares.use('/api/strava/activities', async (req, res) => {
          if (req.method !== 'GET') {
            res.statusCode = 405
            res.end('Method Not Allowed')
            return
          }

          const authHeader = req.headers.authorization
          const accessToken = authHeader?.replace('Bearer ', '')

          if (!accessToken) {
            res.statusCode = 401
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ error: 'Missing access token' }))
            return
          }

          try {
            // Récupérer les activités Strava (8-12 semaines glissantes)
            const perPage = 200
            const activities: any[] = []
            let page = 1
            const now = Date.now()
            const twelveWeeksAgo = now - 12 * 7 * 24 * 60 * 60 * 1000

            while (true) {
              const response = await fetch(
                `https://www.strava.com/api/v3/athlete/activities?page=${page}&per_page=${perPage}`,
                {
                  headers: {
                    Authorization: `Bearer ${accessToken}`,
                  },
                }
              )

              if (!response.ok) {
                if (response.status === 401) {
                  res.statusCode = 401
                  res.setHeader('Content-Type', 'application/json')
                  res.end(JSON.stringify({ error: 'Token expired or invalid' }))
                  return
                }
                const errorText = await response.text()
                res.statusCode = response.status
                res.setHeader('Content-Type', 'application/json')
                res.end(JSON.stringify({ error: errorText }))
                return
              }

              const pageActivities = (await response.json()) as Array<{
                id: number
                start_date: string
                type: string
                distance: number
                total_elevation_gain: number
                moving_time: number
              }>

              if (pageActivities.length === 0) break

              const filtered = pageActivities.filter((act) => {
                const activityDate = new Date(act.start_date).getTime()
                return act.type === 'Run' && activityDate >= twelveWeeksAgo
              })

              activities.push(...filtered)

              if (pageActivities.length < perPage) break

              const lastActivityDate = new Date(pageActivities[pageActivities.length - 1].start_date).getTime()
              if (lastActivityDate < twelveWeeksAgo) break

              page += 1
            }

            const formattedActivities = activities.map((act: any) => ({
              id: String(act.id),
              date: act.start_date,
              distanceKm: act.distance / 1000,
              elevationGain: act.total_elevation_gain || 0,
              movingTimeSec: act.moving_time || 0,
            }))

            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ activities: formattedActivities }))
          } catch (error) {
            console.error('Erreur lors de la récupération des activités Strava:', error)
            res.statusCode = 500
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ error: 'Failed to fetch activities' }))
          }
        })
      },
    },
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
