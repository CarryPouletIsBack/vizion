# TRACKALI — Simulateur de préparation Trail (MVP)

Application React/Vite pour un simulateur de préparation trail basé sur l'analyse de courses, l'import GPX et l'intégration Strava. Le projet suit la maquette Figma et les règles de développement définies dans `DEV_RULES.md`.

## Stack Technique

- **Frontend** : React 18 + TypeScript + Vite
- **Styling** : CSS (tokens dans `src/styles/tokens.css`)
- **Cartographie** : Globe WebGL (écran Saison) ; Google Maps + `@react-google-maps/api` (cartes de détail)
- **Graphiques** : Highcharts (profil d'élévation, données)
- **Backend** : Supabase (Base de données + Auth)
- **API Strava** : Intégration complète (OAuth + données enrichies)
- **Icônes** : React Icons (`react-icons`)

## Démarrer

```bash
npm install
npm run dev
```

L'application sera accessible sur `http://localhost:5173`

## Fonctionnalités Clés (MVP)

### 🗺️ Navigation et Interface

- **Écran Saison** : Globe WebGL plein écran (côtes en lignes, mers transparentes) ; fond fixe sous la sidebar et le header ; globe **interactif** (rotation, zoom) sur cette page uniquement ; référence de positionnement pour toutes les pages (titres, padding, sidebar 200px, main 224px)
- **Écran Événements** : Tableau avec filtres (Highcharts DataGrid)
- **Écran Courses** : Grille de cartes de courses avec statistiques
- **Écran Single Course** : Détails complets d'une course (GPX pleine largeur, profil, analyse) ; **météo et heure avec icônes** (lieu, soleil, horloge, vent — ex. Saint-Pierre · 24° · 01h15 (+3h) · Vent NNE 12 km/h) ; **vent sur le tracé** (grille de flèches Highcharts Vector + pastille) ; **segments numérotés** sur le tracé (étiquettes au-dessus/en dessous pour ne pas superposer) ; **segment actif** mis en évidence sur la page Segment ; **pluie** (gouttes sur les secteurs où il a plu) ; cartes alignées sur le style `course-card` (fond `--color-card-bg`, bordure, backdrop-filter)
- **Compte utilisateur** : Accès via **icône utilisateur** dans le header (connexion / création de compte en modale ; une fois connecté, clic sur l’icône → page Mon compte) ; lien « Mon compte » retiré de la sidebar

### 📊 Intégration Strava

#### Connexion OAuth

- Authentification Strava via OAuth 2.0
- Stockage sécurisé des tokens (Supabase)
- Gestion automatique du refresh token

#### Données récupérées

**Athlète** (`/api/strava/athlete`) :
- Profil (nom, ville, pays, sexe, poids, FTP)
- Clubs, vélos, chaussures avec distances
- Préférences de mesure

**Activités** (`/api/strava/activities`) :
- Distance, D+, temps (moving/elapsed)
- FC moyenne/max, cadence, vitesse
- Suffer Score, calories, achievements
- Best efforts, segment efforts, splits
- Métadonnées (type workout, équipement, flags)

### 📈 Moteur d'Analyse de Préparation

Le moteur compare les métriques Strava avec les exigences de la course pour déterminer le niveau de préparation :

#### Calcul de couverture

- **Distance hebdomadaire** : Minimum 40 km/semaine (objectif idéal : 70% de l'exigence finale)
- **D+ hebdomadaire** : Minimum 1500 m/semaine (objectif idéal : 70% de l'exigence finale)
- **Sortie longue** : Minimum 70 km (objectif idéal : 60% de la distance de course)
- **D+ max en une sortie** : Minimum 6000 m (objectif idéal : 70% du D+ de course)
- **Régularité** : Fréquence des sorties (bonne/moyenne/faible)

#### Recommandations catégorisées

- 🚨 **Priorité immédiate** : Actions critiques à effectuer rapidement
- ⚠️ **Important mais secondaire** : Ajustements nécessaires mais non urgents
- 🧪 **À tester** : Tests de nutrition, équipement, stratégies

#### Page Ma préparation (cœur produit)

- **Hero** : état de préparation (🟢/🟠/🔴), charge 6 semaines, delta vs semaine précédente, **temps estimé** mis en avant
- **Prochaine échéance** : objectifs des 4 prochaines semaines (km/sem, D+/sem, sorties, sortie longue) en bloc dédié
- **Tendance** : courbe d’évolution de la charge sur 6 semaines (M-6 → M-1)
- **Ajustements recommandés** : listes en **tâches à cocher** (persistance par course dans `localStorage`)
- **Préparation par segment** : pour chaque tronçon de la course, D+ du segment et indicateur ✓/! selon le D+ max entraîné
- **Export** : boutons « Imprimer / PDF » et « Copier le lien » ; styles d’impression pour masquer la navigation

#### Statistiques Grand Raid 2025

Intégration des données réelles du Grand Raid Réunion 2025 :
- Points d'abandon critiques
- Distribution des temps de finishers
- Taux d'abandon par section

### ⚙️ Moteur de Simulation

Simulation interactive des performances sur la course :

#### Paramètres ajustables

- **État de forme** : 50-120% (slider)
- **Temps par ravitaillement** : 2-20 min
- **Score d'Engagement (Technicité)** : Bon descendeur / Moyen / Prudent
- **Indice d'Endurance** : Elite / Expérimenté / Intermédiaire / Débutant

#### Projections

- Temps estimé mis à jour en temps réel
- Barrières horaires critiques (basées sur points d'abandon)
- Dégradation de performance selon l'indice d'endurance

### 🗺️ Import et Affichage GPX

#### Conversion GPX → SVG

- Parsing GPX côté client (pas de backend requis)
- Génération SVG du tracé
- Extraction des waypoints uniquement
- Affichage dans les cartes de courses et page Single Course

#### Profil d'élévation

- Graphique Highcharts interactif
- Score d'Engagement (technicité) par segments :
  - 🟢 **Vert (Roulant)** : Pente < 15%
  - 🟠 **Orange (Technique)** : Pente 15-25% ou descente -10 à -20%
  - 🔴 **Rouge (Chaos)** : Pente > 25% ou descente < -20%
- Estimation du profil du coureur (ligne pointillée)
- Synchronisation hover entre graphique et trace GPX

### 📊 Estimation de Temps

Basée sur la logique de [pacing-trail.fr](https://pacing-trail.fr/calculateur-de-temps-de-course-trail/) :

- **Allure de base** : Calculée depuis les métriques Strava
- **Ajustements** :
  - Dénivelé (+1.5% par 1000m D+)
  - Distance (dégradation progressive)
  - Météo (température)
  - Poids du sac
  - Technicité en descente
  - Dégradation selon indice d'endurance
- **Fourchette min-max** : ±15% pour tenir compte de l'incertitude

## Structure du Projet

```
trackali-app/
├── api/
│   ├── strava/           # Routes API Vercel pour Strava
│   │   ├── activities.ts # Récupération activités
│   │   └── athlete.ts    # Récupération profil athlète
│   ├── weather.ts        # Proxy météo (Xweather)
│   ├── timezone.ts       # Fuseau horaire (heure locale + offsetHours UTC)
│   └── simulator/
│       └── refine.ts    # Conseils IA (Mistral API) pour le simulateur
├── public/
│   └── globe/            # Globe WebGL (globe.js, texture world.jpg, Three.js)
├── src/
│   ├── components/       # Composants React réutilisables
│   │   ├── WebGlGlobe.tsx       # Globe 3D (côtes, mers transparentes)
│   │   ├── WindVectorChart.tsx  # Flèches vent sur tracé GPX (Highcharts Vector)
│   │   ├── SimulationEngine.tsx
│   │   ├── SingleCourseElevationChart.tsx
│   │   └── ...
│   ├── pages/            # Pages principales
│   │   ├── SaisonPage.tsx
│   │   ├── EventsPage.tsx
│   │   ├── CoursesPage.tsx
│   │   └── SingleCoursePage.tsx
│   ├── lib/              # Logique métier
│   │   ├── courseAnalysis.ts      # Moteur d'analyse
│   │   ├── svgZoneSegmenter.ts    # Segments numérotés GPX, zoom segment, vue 3D
│   │   ├── stravaEngine.ts        # Calcul métriques Strava
│   │   ├── trailTimeEstimator.ts  # Estimation temps
│   │   ├── profileTechnicity.ts   # Analyse technicité
│   │   └── ...
│   ├── types/            # Types TypeScript
│   │   └── strava.ts
│   ├── data/             # Données statiques
│   │   └── grandRaidStats.ts
│   └── hooks/            # Hooks React personnalisés
│       ├── useStravaMetrics.ts
│       └── useGpxHoverMarker.ts
```

## Persistance des Données (Supabase)

- **Tables** : `events`, `courses`, `users`
- **Chargement automatique** au démarrage
- **Création automatique** d'events si nécessaire
- **Stockage** : Images et SVG en base64 dans la base
- **Row Level Security (RLS)** : Accès sécurisé par utilisateur

## Configuration

### Variables d'environnement

#### Google Maps API

Créez un fichier `.env` à la racine du projet avec :

```env
VITE_GOOGLE_MAPS_API_KEY=your_google_maps_api_key_here
```

**Pour obtenir une clé API Google Maps :**
1. Créez un projet sur [Google Cloud Console](https://console.cloud.google.com/)
2. Activez la **Maps JavaScript API**
3. Créez une clé API dans "Identifiants"
4. Configurez les restrictions (domaines autorisés, quotas) pour la sécurité

⚠️ **Important** : Google Maps est un service payant après le quota gratuit. Configurez des quotas et alertes dans Google Cloud Console pour éviter des factures surprises.

#### Météo Xweather (optionnel)

Pour utiliser la température réelle dans l’estimation de temps (au lieu de 15°C par défaut), configurer dans Vercel :

- `XWEATHER_CLIENT_ID` : Client ID Xweather
- `XWEATHER_CLIENT_SECRET` : Client Secret Xweather

Compte gratuit : [signup.xweather.com/developer](https://signup.xweather.com/developer). L’appel se fait via la route `/api/weather?lat=...&lon=...` ; le client applique un **cache 4h** par position pour limiter les requêtes.

#### Supabase (auth + données, obligatoire en prod)

En production (Vercel), définir :

- `VITE_SUPABASE_URL` : URL du projet (ex. `https://xxxx.supabase.co`)
- `VITE_SUPABASE_ANON_KEY` : clé anon publique

Si les requêtes vers `*.supabase.co` échouent avec **ERR_NAME_NOT_RESOLVED**, vérifier que l’URL est correcte et que le projet Supabase n’est pas en pause (dashboard Supabase).

#### IA pour le simulateur (Conseils IA – optionnel)

Le bouton **« Conseils IA »** dans le Moteur de Simulation envoie la situation (course, métriques, estimation) à un modèle de langage pour obtenir une fourchette de temps et des conseils jour J.

- **En local (développement)** : le serveur Vite appelle **Ollama** sur ta machine. Lance Ollama et un modèle Mistral :
  ```bash
  ollama run mistral
  ```
  L’app tourne sur `http://localhost:5173` ; le middleware appelle `http://localhost:11434` par défaut. Optionnel : `OLLAMA_URL`, `OLLAMA_SIMULATOR_MODEL` (défaut `mistral`).

- **En production (Vercel)** : utilise l’**API Mistral**. Dans Vercel, définis :
  - `MISTRAL_API_KEY` : clé API Mistral ([console Mistral](https://console.mistral.ai/))
  - Optionnel : `MISTRAL_SIMULATOR_MODEL` (défaut : `mistral-small-latest`)

**Note** : **mistral-vibe** est un assistant en ligne de commande (CLI) pour le code ; il ne sert pas de serveur de modèle pour Trackali. Pour améliorer le simulateur avec l’IA, il faut soit **Ollama** (local) soit l’**API Mistral** (cloud), comme ci‑dessus.

#### Strava OAuth (pour les routes API Vercel)

Variables d'environnement Vercel :

- `STRAVA_CLIENT_ID` : Client ID Strava
- `STRAVA_CLIENT_SECRET` : Client Secret Strava

### Redirect URIs

- **Développement** : `http://localhost:5173/auth/strava/callback`
- **Production** : `https://trackali-blush.vercel.app/auth/strava/callback`

⚠️ La Redirect URI doit correspondre **exactement** à celle configurée dans Strava.

## Règles de Développement

- **Pas de `!important`** dans le CSS
- **Code commenté en français** quand nécessaire
- **Mobile-first** : Approche responsive
- **Composants modulaires** : Réutilisables et maintenables
- **Validation des données** : TypeScript strict

## Améliorations Futures

- [ ] Synchronisation automatique Strava (webhooks)
- [ ] Comparaison multi-courses
- [ ] Intégration météo pour l'estimation de temps (partiellement en place : température + vent)
- [ ] Historique des analyses dans le temps (données réelles par semaine)
- [ ] Notifications / rappels (objectifs 4 semaines, reprise d’activité)

## Notes

- Les icônes utilisent `react-icons` (remplacement des emojis)
- Les graphiques utilisent Highcharts
- L’écran Saison utilise un **globe WebGL** (Three.js) en fond plein écran : côtes en lignes, mers transparentes ; les cartes de détail utilisent Google Maps
- L'analyse est basée sur les 6-12 dernières semaines d'activités Strava
- **Cartes** : Fond commun `--color-card-bg` (noir 30 %) dans `tokens.css` ; style de référence = `.course-card` (bordure, backdrop-filter, border-radius)
- **Scrollbar** : Style global (index.css) aligné sur le portfolio (WebKit + Firefox, fin, arrondi, semi-transparent)
- **Note temporaire** : La fonctionnalité "Événements" est masquée dans la navigation. Les courses sont indépendantes pour le moment et ne nécessitent pas d'être regroupées dans un événement parent.

## Déploiement

Le projet est déployé sur Vercel : [https://trackali-blush.vercel.app](https://trackali-blush.vercel.app)

---

**Développé avec ❤️ pour les trailers passionnés**
