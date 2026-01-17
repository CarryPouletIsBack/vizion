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

## Données en mémoire

Les événements/courses et les stats GPX sont stockés en mémoire (state React) pour être réutilisés entre:

- `CoursesPage`
- `SingleCoursePage`

## Notes

- Les pages sont en mode desktop-first.
- Pas de `!important` dans le CSS.
- Le code est commenté en français quand nécessaire.

## Connexion Strava (séparation des applis)

- L’appli Vizion doit avoir son propre couple `client_id` / `client_secret` et ses propres URLs de redirection (pas celles de anthony-merault.fr).  
- Les tokens Strava sont distincts par application : connecter Vizion n’efface ni ne coupe l’accès de l’autre site.  
- En dev local, utiliser une redirection `http://localhost:5173` (ou le port actif) et stocker les secrets côté serveur (pas dans le front).  
- Prévoir un cache côté backend/proxy pour limiter les appels et respecter les quotas Strava.
