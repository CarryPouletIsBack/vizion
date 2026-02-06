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
    {
      name: 'weather-api',
      configureServer(server) {
        server.middlewares.use('/api/weather', async (req, res) => {
          if (req.method !== 'GET') {
            res.statusCode = 405
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ error: 'Method Not Allowed' }))
            return
          }

          const url = new URL(req.url || '/', `http://${req.headers.host}`)
          const lat = url.searchParams.get('lat')
          const lon = url.searchParams.get('lon')
          const latNum = lat != null ? parseFloat(lat) : NaN
          const lonNum = lon != null ? parseFloat(lon) : NaN

          if (Number.isNaN(latNum) || Number.isNaN(lonNum) || latNum < -90 || latNum > 90 || lonNum < -180 || lonNum > 180) {
            res.statusCode = 400
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ error: 'Paramètres lat et lon requis et valides' }))
            return
          }

          const clientId = process.env.XWEATHER_CLIENT_ID
          const clientSecret = process.env.XWEATHER_CLIENT_SECRET

          if (!clientId || !clientSecret) {
            res.statusCode = 200
            res.setHeader('Content-Type', 'application/json')
            res.setHeader('Cache-Control', 'public, max-age=3600')
            res.end(JSON.stringify({ tempC: 24, icon: 'fair', rainLast24h: false }))
            return
          }

          try {
            const apiUrl = `https://api.aerisapi.com/observations/closest?p=${latNum},${lonNum}&client_id=${encodeURIComponent(clientId)}&client_secret=${encodeURIComponent(clientSecret)}`
            const response = await fetch(apiUrl, { headers: { Accept: 'application/json' } })
            if (!response.ok) {
              res.statusCode = 502
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify({ error: 'Erreur API météo', status: response.status }))
              return
            }
            const data = (await response.json()) as {
              success?: boolean
              response?: Array<{ ob?: { tempC?: number; temp?: number; icon?: string; weather?: string; precipMM?: number; precipIN?: number; precipTodayMM?: number; precipTodayIN?: number } }>
              error?: { description?: string }
            }
            if (!data.success && data.error) {
              res.statusCode = 502
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify({ error: 'Erreur API météo', message: data.error?.description }))
              return
            }
            const ob = data.response?.[0]?.ob
            const tempC = ob?.tempC ?? ob?.temp ?? null
            const icon = ob?.icon ?? ob?.weather ?? undefined
            if (tempC == null) {
              res.statusCode = 502
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify({ error: 'Données météo incomplètes' }))
              return
            }
            const precipMM = ob?.precipTodayMM ?? ob?.precipMM ?? (ob?.precipTodayIN != null ? ob.precipTodayIN * 25.4 : undefined) ?? (ob?.precipIN != null ? ob.precipIN * 25.4 : undefined)
            const rainLast24h = precipMM != null ? precipMM > 0 : undefined
            res.setHeader('Content-Type', 'application/json')
            res.setHeader('Cache-Control', 'public, max-age=14400, s-maxage=14400')
            res.end(JSON.stringify({ tempC: Number(tempC), icon: icon ?? undefined, rainLast24h: rainLast24h ?? undefined }))
          } catch (err) {
            res.statusCode = 500
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ error: 'Erreur serveur météo', message: err instanceof Error ? err.message : 'Erreur inconnue' }))
          }
        })
      },
    },
    {
      name: 'timezone-api',
      configureServer(server) {
        server.middlewares.use('/api/timezone', async (req, res) => {
          if (req.method !== 'GET') {
            res.statusCode = 405
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ error: 'Method Not Allowed' }))
            return
          }
          const url = new URL(req.url || '/', `http://${req.headers.host}`)
          const lat = url.searchParams.get('lat')
          const lon = url.searchParams.get('lon')
          const latNum = lat != null ? parseFloat(lat) : NaN
          const lonNum = lon != null ? parseFloat(lon) : NaN
          if (Number.isNaN(latNum) || Number.isNaN(lonNum) || latNum < -90 || latNum > 90 || lonNum < -180 || lonNum > 180) {
            res.statusCode = 400
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ error: 'Paramètres lat et lon requis et valides' }))
            return
          }
          try {
            const { find } = await import('geo-tz')
            const zones = find(latNum, lonNum)
            const timezone = zones?.length ? zones[0] : 'UTC'
            const now = new Date()
            const formatter = new Intl.DateTimeFormat('fr-FR', { timeZone: timezone, hour: '2-digit', minute: '2-digit', hour12: false })
            const timeShort = formatter.format(now).replace(':', 'h')
            let offsetHours = 0
            try {
              const parts = new Intl.DateTimeFormat('en-US', { timeZone: timezone, timeZoneName: 'longOffset' }).formatToParts(now)
              const tzPart = parts.find((p) => p.type === 'timeZoneName')
              const value = tzPart?.value ?? ''
              const match = value.match(/GMT([+-])(\d+)(?::(\d+))?/)
              if (match) {
                const sign = match[1] === '+' ? 1 : -1
                const h = parseInt(match[2], 10)
                const m = match[3] ? parseInt(match[3], 10) : 0
                offsetHours = sign * (h + m / 60)
              }
            } catch {
              // garder 0
            }
            res.setHeader('Content-Type', 'application/json')
            res.setHeader('Cache-Control', 'public, max-age=60')
            res.end(JSON.stringify({ timezone, time: timeShort, offsetHours }))
          } catch (err) {
            const timeShort = new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date()).replace(':', 'h')
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ timezone: 'UTC', time: timeShort, offsetHours: 0 }))
          }
        })
      },
    },
    {
      name: 'simulator-refine-api',
      configureServer(server) {
        server.middlewares.use('/api/simulator/refine', (req, res) => {
          if (req.method !== 'POST') {
            res.statusCode = 405
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ error: 'Method Not Allowed' }))
            return
          }
          const chunks: Buffer[] = []
          req.on('data', (chunk: Buffer) => chunks.push(chunk))
          req.on('end', async () => {
          const body = JSON.parse(Buffer.concat(chunks).toString('utf8'))
          const { distanceKm, elevationGain, metricsSummary, currentEstimate, params } = body
          if (typeof distanceKm !== 'number' || typeof elevationGain !== 'number' || !currentEstimate?.rangeFormatted) {
            res.statusCode = 400
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ error: 'Body invalide', message: 'Requiert distanceKm, elevationGain, currentEstimate.rangeFormatted' }))
            return
          }
          const promptLines = [
            'Tu es un coach trail expert. Donne UNIQUEMENT une fourchette de temps réaliste pour cette course, sous forme d\'objet JSON.',
            '',
            `**Course** : ${distanceKm} km, ${elevationGain} m D+.`,
            `**Estimation actuelle du simulateur** : ${currentEstimate.rangeFormatted} (temps central : ${currentEstimate.formatted}).`,
            `Allure de base : ${currentEstimate.basePace?.toFixed?.(1) ?? '-'} min/km, allure ajustée : ${currentEstimate.finalPace?.toFixed?.(1) ?? '-'} min/km.`,
          ]
          if (metricsSummary) promptLines.push('', `**Profil coureur** : ${metricsSummary}`)
          if (params) promptLines.push('', `**Paramètres** : forme ${params.fitnessLevel ?? '-'}%, technicité ${params.technicalIndex ?? '-'}, endurance ${params.enduranceIndex ?? '-'}, ravitaillements ${params.refuelStops ?? '-'}, température ${params.temperature ?? '-'}°C.`)
          promptLines.push('', 'Réponds UNIQUEMENT avec un JSON valide, sans texte avant ou après, avec exactement ces deux clés (nombres entiers, temps total de course en minutes) :', '{"suggestedMinMinutes": <nombre>, "suggestedMaxMinutes": <nombre>}', 'Exemple pour 28h-32h : {"suggestedMinMinutes": 1680, "suggestedMaxMinutes": 1920}')
          const prompt = promptLines.join('\n')
          const ollamaUrl = process.env.OLLAMA_URL || 'http://localhost:11434'
          function parseJsonFromResponse(content: string) {
            const trimmed = (content || '').trim()
            const jsonMatch = trimmed.match(/\{[\s\S]*"suggestedMinMinutes"[\s\S]*"suggestedMaxMinutes"[\s\S]*\}/) || trimmed.match(/\{[\s\S]*\}/)
            if (!jsonMatch) return null
            try {
              const parsed = JSON.parse(jsonMatch[0])
              const min = typeof parsed.suggestedMinMinutes === 'number' ? Math.round(parsed.suggestedMinMinutes) : null
              const max = typeof parsed.suggestedMaxMinutes === 'number' ? Math.round(parsed.suggestedMaxMinutes) : null
              if (min == null || max == null || min < 0 || max < 0 || min > max) return null
              return { suggestedMinMinutes: min, suggestedMaxMinutes: max }
            } catch {
              return null
            }
          }
          try {
            const ollamaRes = await fetch(`${ollamaUrl}/api/chat`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                model: process.env.OLLAMA_SIMULATOR_MODEL || 'mistral',
                messages: [{ role: 'user', content: prompt }],
                stream: false,
              }),
            })
            if (!ollamaRes.ok) {
              res.statusCode = 503
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify({ error: 'Ollama indisponible', message: `Lancer Ollama (ollama run mistral) et laisser ${ollamaUrl} actif.` }))
              return
            }
            const data = await ollamaRes.json() as { message?: { content?: string } }
            const content = data?.message?.content?.trim() || ''
            const refined = parseJsonFromResponse(content)
            if (!refined) {
              res.statusCode = 422
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify({ error: 'Réponse IA invalide', message: 'Le modèle n\'a pas renvoyé un JSON avec suggestedMinMinutes et suggestedMaxMinutes.' }))
              return
            }
            res.setHeader('Content-Type', 'application/json')
            res.setHeader('Cache-Control', 'no-store')
            res.end(JSON.stringify(refined))
          } catch (err: unknown) {
            res.statusCode = 500
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ error: 'Erreur Ollama', message: err instanceof Error ? err.message : 'Erreur inconnue' }))
          }
          })
        })
      },
    },
    {
      name: 'versor-dragging-files',
        configureServer(server) {
          // Serve JSON files from @d3/versor-dragging package
          server.middlewares.use('/node_modules/@d3/versor-dragging/files', async (req, res) => {
            const url = new URL(req.url || '/', `http://${req.headers.host}`)
            const filename = url.pathname.split('/').pop()
            
            if (!filename || !filename.endsWith('.json')) {
              res.statusCode = 404
              res.end('Not found')
              return
            }

            try {
              const filePath = path.join(__dirname, 'node_modules/@d3/versor-dragging/files', filename)
              const fileContent = await fs.readFile(filePath, 'utf-8')
              res.setHeader('Content-Type', 'application/json')
              res.setHeader('Access-Control-Allow-Origin', '*')
              res.end(fileContent)
            } catch (error) {
              res.statusCode = 404
              res.end('File not found')
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
