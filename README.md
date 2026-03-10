# Kaldera — Simulateur de préparation Trail (MVP)

**Version : 0.1.0 (bêta)**

Application React/Vite pour un simulateur de préparation trail basé sur l'analyse de courses, l'import GPX et l'intégration Strava. Le projet suit la maquette Figma et les règles de développement définies dans `DEV_RULES.md`.

## Stack Technique

- **Frontend** : React 18 + TypeScript + Vite
- **Styling** : CSS (tokens dans `src/styles/tokens.css`) + **Tailwind CSS v4** (PostCSS : `postcss.config.js`, `@import "tailwindcss"` dans `src/index.css`)
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

- **Écran Saison (Accueil)** : Globe WebGL plein écran (côtes en lignes, mers transparentes) ; fond fixe sous la sidebar et le header ; globe **interactif** (rotation, zoom) sur cette page uniquement ; sidebar sticky avec fond semi-transparent (backdrop-filter) harmonisée sur toutes les pages
- **Écran Événements** : Tableau avec filtres (Highcharts DataGrid)
- **Écran Parcours** : Grille de cartes de parcours avec statistiques ; sections « Parcours de la communauté » et « Mes parcours en cours »
- **Écran Single Parcours** : Détails complets d'un parcours (GPX pleine largeur, profil, analyse) ; bouton « Choisir le parcours » pour ajouter à Mes parcours ; **météo et heure avec icônes** (lieu, soleil, horloge, vent) ; **vent sur le tracé** (grille de flèches Highcharts Vector + pastille) ; **segments numérotés** sur le tracé ; **segment actif** mis en évidence ; **pluie** (gouttes sur les secteurs où il a plu)
- **Compte utilisateur** : Accès via **icône utilisateur** dans le header (connexion / création de compte en modale ; une fois connecté, clic sur l’icône → page Mon compte) ; lien « Mon compte » retiré de la sidebar

### 📁 Compte Trackali et import .fit

- **Compte Trackali** : Création de compte (email / mot de passe) via la modale ; Strava devient **optionnel** pour l’analyse.
- **Import .fit** : Sur la page **Ma préparation** (bouton « Importer .fit ») et dans **Mon compte** (section « Vos 5 sorties les plus longues »). Les fichiers .fit sont parsés (lib `fit-file-parser`) ; résumé : distance, durée, D+, sport.
- **Sauvegarde avec l’utilisateur** : Si l’utilisateur est connecté (Trackali), chaque .fit importé est enregistré en base (table `user_fit_activities`, Supabase).
- **5 sorties les plus longues** : En **Mon compte**, l’utilisateur peut ajouter plusieurs .fit ; la liste est triée par « longueur » (distance + D+). Les **5 meilleures** sont utilisées pour l’analyse de préparation (métriques fusionnées avec Strava si connecté, ou 100 % .fit sinon).
- **Analyse** : Charge, longue sortie max, recommandations et niveau de préparation (🟢/🟠/🔴) sont calculés à partir des métriques Strava (si connecté) et/ou des 5 .fit (voir `src/lib/fitMetricsMerge.ts`, `userFitActivities.ts`, `parseFitFile.ts`).

### 📊 Intégration Strava (optionnelle)

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

- **Distance hebdomadaire** : Seuils proportionnés à la course (ex. course 9 km → objectif réaliste ~5–11 km/sem)
- **D+ hebdomadaire** : Proportionnel au D+ de la course (courses courtes &lt; 500 m D+ : objectifs adaptés)
- **Sortie longue** : Court (&lt; 20 km) : 70 % de la distance ; long : 40 % min (objectif idéal 60 %)
- **D+ max en une sortie** : Proportionnel (courses &lt; 500 m D+ : 50 % du D+ course)
- **Régularité** : Fréquence des sorties (bonne/moyenne/faible)
- **Courses très courtes** (≤ 12 km, &lt; 600 m D+) : si la longue sortie couvre la distance, le statut n’est pas « Risque » uniquement pour D+ manquant ; recommandation dénivelé sans bloquer.

#### Recommandations catégorisées

- 🚨 **Priorité immédiate** : Actions critiques à effectuer rapidement
- ⚠️ **Important mais secondaire** : Ajustements nécessaires mais non urgents
- 🧪 **À tester** : Tests de nutrition, équipement, stratégies

#### Page Ma préparation (cœur produit)

- **Hero** : état de préparation (🟢/🟠/🔴), charge 6 semaines, delta vs semaine précédente, **temps estimé** mis en avant
- **Prochaine échéance** : objectifs des 4 prochaines semaines (km/sem, D+/sem, sorties, sortie longue) en bloc dédié
- **Tendance** : courbe d’évolution de la charge sur 6 semaines (M-6 → M-1)
- **Textes générés par l’IA** : résumé, verdict du coach, objectifs, recommandations (priorité immédiate / secondaire), projection (« Si tu continues ainsi » / « Si tu suis les objectifs ») et intro segments sont générés par l’IA (Mistral) à partir des sorties .fit et de la course. **Génération une seule fois** par contexte (course + .fit), **mise en cache 7 jours** ; bouton « Rafraîchir » pour forcer une nouvelle génération. Voir `api/preparation/content.ts` et variable `MISTRAL_API_KEY`.
- **Ajustements recommandés** : listes en **tâches à cocher** (persistance par course dans `localStorage`)
- **Import .fit** : bouton « Importer .fit » ; résumé (km, durée, D+) ; si compte Trackali, enregistrement en base et prise en compte dans les 5 sorties les plus longues
- **Fusion métriques** : si Strava est connecté mais sans activité (0 km/sem, 0 D+), les volumes et la régularité issus des 5 .fit sont utilisés pour l’analyse afin d’éviter un statut « Risque » à tort (`fitMetricsMerge.ts`).
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
│   ├── preparation/      # Ma préparation – contenu IA
│   │   ├── advice.ts     # Conseils personnalisés (paragraphe) – optionnel
│   │   └── content.ts    # Contenu complet Ma préparation (résumé, verdict, recommandations, projection) – cache 7j côté client
│   ├── weather.ts        # Proxy météo (Open-Meteo)
│   ├── timezone.ts       # Fuseau horaire (offsetHours ; fallback La Réunion UTC+4 en prod)
│   └── simulator/
│       └── refine.ts     # Affinage temps simulateur (Mistral API)
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
│   │   ├── SaisonPage.tsx       # Accueil (globe)
│   │   ├── EventsPage.tsx
│   │   ├── CoursesPage.tsx      # Parcours
│   │   └── SingleCoursePage.tsx # Détail parcours
│   ├── lib/              # Logique métier
│   │   ├── courseAnalysis.ts      # Moteur d'analyse
│   │   ├── svgZoneSegmenter.ts    # Segments numérotés GPX, zoom segment, vue 3D
│   │   ├── stravaEngine.ts        # Calcul métriques Strava
│   │   ├── trailTimeEstimator.ts  # Estimation temps
│   │   ├── profileTechnicity.ts   # Analyse technicité
│   │   ├── fitMetricsMerge.ts     # Fusion métriques Strava + .fit (5 sorties longues)
│   │   ├── userFitActivities.ts   # CRUD activités .fit (Supabase)
│   │   ├── parseFitFile.ts        # Parsing .fit → résumé (distance, D+, durée)
│   │   ├── userCourseSelections.ts # CRUD parcours choisis (Mes parcours)
│   │   └── ...
│   ├── types/            # Types TypeScript
│   │   └── strava.ts
│   ├── data/             # Données statiques
│   │   └── grandRaidStats.ts
│   └── hooks/            # Hooks React personnalisés
│       ├── useStravaMetrics.ts
│       ├── useGpxHoverMarker.ts
│       └── useMyParcoursButton.ts  # État « Choisir le parcours » / « Dans Mes parcours »
```

## Persistance des Données (Supabase)

- **Tables** : `events`, `courses` (colonnes `created_by_user_id`, `is_published`), `user_course_selections` (parcours choisis par l'utilisateur), `user_fit_activities` (activités .fit par utilisateur)
- **Auth** : Compte Trackali (email/mot de passe) ; pas de table `users` dédiée, auth via Supabase Auth
- **Chargement automatique** des events/courses au démarrage
- **user_fit_activities** : `user_id`, `file_name`, `summary` (JSON), `imported_at` ; RLS par `auth.uid()`
- **user_course_selections** : association utilisateur ↔ parcours choisi ; RLS par `auth.uid()`
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

#### Météo (Open-Meteo)

La température et la pluie (24h) pour l’estimation de temps et l'affichage région sont fournies par **Open-Meteo** (modèle Météo-France). Aucune clé API n'est requise pour un usage non commercial.


Documentation : [open-meteo.com/en/docs/meteofrance-api](https://open-meteo.com/en/docs/meteofrance-api). L’appel se fait via la route `/api/weather?lat=...&lon=...` ; le client applique un **cache 4h** par position pour limiter les requêtes.

#### Supabase (auth + données, obligatoire en prod)

En production (Vercel), définir :

- `VITE_SUPABASE_URL` : URL du projet (ex. `https://xxxx.supabase.co`)
- `VITE_SUPABASE_ANON_KEY` : clé anon publique

Si les requêtes vers `*.supabase.co` échouent avec **ERR_NAME_NOT_RESOLVED**, vérifier que l’URL est correcte et que le projet Supabase n’est pas en pause (dashboard Supabase).

#### IA (Mistral – optionnel)

Deux usages de l’IA (Mistral) dans l’app :

1. **Simulateur – « Affiner avec l’IA »**  
   Le bouton envoie la situation (course, métriques, estimation) au modèle pour une fourchette de temps affinée. En local : **Ollama** (`ollama run mistral`, `OLLAMA_URL`, `OLLAMA_SIMULATOR_MODEL`). En prod (Vercel) : **API Mistral** (`MISTRAL_API_KEY`, optionnel `MISTRAL_SIMULATOR_MODEL`).

2. **Ma préparation – textes générés par l’IA**  
   Les textes de la section Ma préparation (résumé, verdict du coach, objectifs, recommandations, projection) sont générés par l’IA à partir de la course et des sorties .fit. **Une seule génération** par contexte (course + .fit), **mise en cache 7 jours** côté client ; bouton « Rafraîchir » pour régénérer. En production (Vercel), définir :
   - `MISTRAL_API_KEY` : clé API Mistral ([console Mistral](https://console.mistral.ai/))
   - Optionnel : `MISTRAL_SIMULATOR_MODEL` (défaut : `mistral-small-latest`)

Sans `MISTRAL_API_KEY`, les textes Ma préparation restent ceux du moteur d’analyse (règles fixes) et le bouton « Affiner avec l’IA » du simulateur est indisponible.

#### Strava OAuth (pour les routes API Vercel)

Variables d'environnement Vercel :

- `STRAVA_CLIENT_ID` : Client ID Strava
- `STRAVA_CLIENT_SECRET` : Client Secret Strava

### Redirect URIs

- **Développement** : `http://localhost:5173/auth/strava/callback`
- **Production** : à configurer selon l’URL de déploiement (ex. `https://votre-app.vercel.app/auth/strava/callback`)

⚠️ La Redirect URI doit correspondre **exactement** à celle configurée dans Strava.

## Règles de Développement

- **Pas de `!important`** dans le CSS
- **Code commenté en français** quand nécessaire
- **Mobile-first** : Approche responsive
- **Composants modulaires** : Réutilisables et maintenables
- **Validation des données** : TypeScript strict

## Refonte visuelle et UX (branche `refactor-css`)

Des ajustements visuels et UX importants ont été réalisés sur la branche **refactor-css** :

- **Page parcours (Single Course)**  
  - Météo parcours (ville, °C, heure, vent) déplacée dans la topbar (`saison-topbar__weather`). En vue **Segment**, la flèche vent est affichée dans le texte météo (topbar) ; pastille vent fixe sur la carte supprimée en segment.  
  - Fil d'Ariane : suppression de « Parcours » à gauche du nom du parcours. En vue **Segment**, le breadcrumb est masqué ; un **chevron gauche** à gauche du nom du parcours permet de revenir à l’étape Description.  
  - **Layout vue Segment** : colonne gauche (en-tête + contenu) et carte 2D/3D à droite ; largeur de la colonne gauche alignée sur la carte data viz dénivelé (`min(480px, 100vw - 2×marge)`).  
  - Barre d’outils segment : bouton Vue 2D/3D conservé ; bouton **Plein écran** supprimé.  
  - Cartes fixes en bas : carte graphique secteur (profil dénivelé) à gauche, carte stats secteur (Longueur, D+, D-, etc.) à droite, sans fond/bordure superflus.

- **Autres**  
  - Toolbar GPX (Vue 2D/3D) positionnée sous « Lancer ma préparation » puis en haut du header en vue segment.  
  - Secteurs : pastilles numérotées dans un slider horizontal (carte graphique) ; bandeau/titre « Secteur X » supprimé.  
  - Conseil de passage remis sous « Circuit sec — pas de pluie… », max-width 508 px.

### Prochaines étapes

- **Page Segment en mobile** : adapter la page segment (layout, cartes fixes, toolbar, chevron retour) pour une bonne utilisation en vue mobile.  
- **Branches et déploiement** :  
  - **`main`** = production en cours ; **ne pas toucher** à `main` pour la prod.  
  - Créer une nouvelle branche **`master`** (ou branche dédiée) et y pousser le contenu de **`refactor-css`** pour faire évoluer la refonte sans impacter la prod.  
  - Fusionner ensuite `refactor-css` → `master` (ou la branche cible) quand les tests sont validés, puis déployer depuis cette branche lorsque l’on souhaite remplacer la prod.

## Améliorations Futures

- [ ] Synchronisation automatique Strava (webhooks)
- [ ] Comparaison multi-courses
- [x] Intégration météo pour l'estimation de temps (Open-Meteo / Météo-France)
- [ ] Export PDF du rapport de préparation
- [ ] Partage de préparation avec coach/amis
- [ ] Historique des analyses dans le temps (données réelles par semaine)
- [ ] Notifications / rappels (objectifs 4 semaines, reprise d’activité)
- [ ] Adapter la page Segment en vue mobile (layout, cartes, toolbar, retour)

- [ ] Option : limiter à 5 .fit « officiels » par utilisateur

## Notes

- Les icônes utilisent `react-icons` (remplacement des emojis)
- Les graphiques utilisent Highcharts
- L’écran Saison utilise un **globe WebGL** (Three.js) en fond plein écran : côtes en lignes, mers transparentes ; les cartes de détail utilisent Google Maps
- L'analyse est basée sur les 6-12 dernières semaines d'activités Strava
- **Cartes** : Fond commun `--color-card-bg` (noir 30 %) dans `tokens.css` ; style de référence = `.course-card` (bordure, backdrop-filter, border-radius)
- **Scrollbar** : Style global (index.css) aligné sur le portfolio (WebKit + Firefox, fin, arrondi, semi-transparent)
- **Terminologie** : Parcours (plutôt que « courses ») dans la navigation et l’interface. Les parcours peuvent être créés (option « Publier ») ou choisis (« Mes parcours en cours »).
- **Note temporaire** : La fonctionnalité « Événements » est masquée dans la navigation.
- **Heure de la course** : Affichée côté client à partir de l’offset fuseau renvoyé par `/api/timezone` ; pour La Réunion, l’API force `Indian/Reunion` (UTC+4) en prod pour éviter les écarts liés à l’environnement.

## Déploiement

Le projet peut être déployé sur Vercel (ou tout hébergeur supportant Vite/React). Configurer les variables d’environnement en production ; ne jamais committer `.env` ni de clés réelles.

---

**Développé avec ❤️ pour les trailers passionnés**
