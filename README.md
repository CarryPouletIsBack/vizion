# VIZION — Simulateur de préparation Trail (MVP)

Application React/Vite pour un simulateur de préparation trail basé sur l’analyse de courses et l’import GPX. Le projet suit la maquette Figma et les règles de développement définies dans `DEV_RULES.md`.

## Stack

- React + TypeScript + Vite
- Styling CSS (tokens dans `src/styles/tokens.css`)
- Map: `react-simple-maps`
- DataGrid: `@highcharts/dashboards`

## Démarrer

```bash
npm install
npm run dev
```

## Fonctionnalités clés (MVP)

- Écrans: Saison, Événements, Courses, Single Course
- Popups de création événement/course
- Import GPX + génération d’un tracé SVG
- Affichage des stats GPX (distance + D+)
- Navigation simple via état interne (pas de router pour l’instant)

## Conversion GPX → SVG

Le tracé SVG est généré via un script Python local, appelé par un middleware Vite.

- Script: `scripts/gpx_to_svg.py`
- Endpoint: `POST /api/gpx-to-svg`
- Fichiers temporaires: `/tmp/vizion-gpx`

## Persistance des données (Supabase)

Les événements et courses sont persistés dans Supabase :

- Tables : `events` et `courses`
- Chargement automatique au démarrage
- Création automatique d'events si nécessaire
- Conversion des images/SVG en base64 pour le stockage
- Parsing correct du profile JSONB depuis Supabase
- ✅ **Testé et fonctionnel** : création de courses avec GPX, persistance après refresh

## Notes

- Les pages sont en mode desktop-first.
- Pas de `!important` dans le CSS.
- Le code est commenté en français quand nécessaire.

## Connexion Strava OAuth

### Configuration

1. **Créer une application Strava** :
   - Aller sur https://www.strava.com/settings/api
   - Créer une nouvelle application (ou utiliser celle existante de `portfolio-react-anthony`)
   - Noter le `Client ID` et `Client Secret`

2. **Configurer la Redirect URI dans Strava** :
   - En développement : `http://localhost:5173/auth/strava/callback`
   - En production : `https://vizion-blush.vercel.app/auth/strava/callback`
   - ⚠️ La Redirect URI doit correspondre **exactement** à celle configurée dans Strava

3. **Variables d'environnement Vercel** :
   - Aller dans Vercel > Settings > Environment Variables
   - Ajouter les variables suivantes (déjà configurées pour `portfolio-react-anthony`) :
     - `STRAVA_CLIENT_ID` : Votre Client ID Strava
     - `STRAVA_CLIENT_SECRET` : Votre Client Secret Strava
   - ⚠️ Ces variables sont sécurisées côté serveur (endpoints API Vercel)

4. **Développement local** :
   - Créer un fichier `.env.local` à partir de `.env.example`
   - Remplir `STRAVA_CLIENT_ID` et `STRAVA_CLIENT_SECRET` pour le développement local
   - Les endpoints API utiliseront ces variables en local

### Flow OAuth

1. L'utilisateur clique sur "Se connecter" → redirection vers Strava
2. Strava redirige vers `/auth/strava/callback?code=...`
3. Le code est échangé contre un `access_token` et `refresh_token`
4. Les tokens sont stockés (localStorage temporaire, Supabase en production)

### Notes importantes

- L'appli Vizion doit avoir son propre couple `client_id` / `client_secret` (distinct de anthony-merault.fr)
- Les tokens Strava sont distincts par application : connecter Vizion n'efface pas l'accès de l'autre site
- Prévoir un cache côté backend pour limiter les appels et respecter les quotas Strava
- En production, utiliser un backend sécurisé pour l'échange du code (ne pas exposer le `client_secret`)
