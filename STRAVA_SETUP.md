# Configuration Strava OAuth pour Trackali

## Problème : "Bad Request - client_id invalid"

Cette erreur signifie que le `STRAVA_CLIENT_ID` n'est pas correctement configuré dans Vercel.

## Solution : Configurer les variables d'environnement dans Vercel

### 1. Accéder aux variables d'environnement Vercel

1. Aller sur https://vercel.com
2. Sélectionner le projet **trackali** (ou le nom de votre projet)
3. Aller dans **Settings** > **Environment Variables**

### 2. Ajouter les variables Strava

Ajouter les deux variables suivantes (qui sont déjà configurées pour `portfolio-react-anthony`) :

| Variable | Valeur | Environnements |
|----------|--------|----------------|
| `STRAVA_CLIENT_ID` | Votre Client ID Strava | Production, Preview, Development |
| `STRAVA_CLIENT_SECRET` | Votre Client Secret Strava | Production, Preview, Development |

### 3. Où trouver les valeurs ?

1. Aller sur https://www.strava.com/settings/api
2. Si vous avez déjà une application (celle de `portfolio-react-anthony`), vous pouvez réutiliser les mêmes valeurs
3. Sinon, créer une nouvelle application et noter le `Client ID` et `Client Secret`

### 4. Configurer le domaine de rappel dans Strava

Dans les paramètres de votre application Strava (voir l'image ci-dessus) :

1. Ouvrir la modal "Modifier l'application"
2. Dans le champ **"Domaine du rappel pour l'autorisation (Callback domain for authorization)"**, entrer :
   - **Production** : `trackali-blush.vercel.app` (sans `https://` et sans le chemin `/auth/strava/callback`)
   - **Développement local** : `localhost` (pour tester en local)

⚠️ **Important** : 
- Strava n'accepte qu'**un seul domaine** par application
- Si vous avez déjà une application pour `portfolio-react-anthony`, créez une **nouvelle application** pour Trackali
- Le domaine doit correspondre exactement au domaine de votre application (sans le protocole `https://`)

**Exemple** :
- ✅ Correct : `trackali-blush.vercel.app`
- ❌ Incorrect : `https://trackali-blush.vercel.app`
- ❌ Incorrect : `trackali-blush.vercel.app/auth/strava/callback`

### 5. Redéployer sur Vercel

Après avoir ajouté les variables d'environnement :

1. Aller dans **Deployments**
2. Cliquer sur les trois points (`...`) du dernier déploiement
3. Sélectionner **Redeploy**
4. Vérifier que les variables d'environnement sont bien sélectionnées

### 6. Vérification

Pour vérifier que la configuration fonctionne :

1. Ouvrir la console du navigateur (F12)
2. Cliquer sur "Se connecter" dans l'application
3. Vérifier qu'il n'y a pas d'erreur dans la console
4. Vous devriez être redirigé vers Strava pour l'autorisation

## Développement local

Pour le développement local, créer un fichier `.env.local` à la racine du projet :

```env
VITE_STRAVA_CLIENT_ID=votre_client_id_ici
STRAVA_CLIENT_SECRET=votre_client_secret_ici
```

⚠️ **Note** : Le `STRAVA_CLIENT_SECRET` n'est utilisé que par les endpoints API Vercel, pas côté client.

## Dépannage

### Erreur : "STRAVA_CLIENT_ID not configured"

- Vérifier que la variable est bien configurée dans Vercel
- Vérifier que le déploiement a été redéployé après l'ajout de la variable
- Vérifier que la variable est disponible pour l'environnement (Production/Preview/Development)

### Erreur : "Bad Request - client_id invalid"

- Vérifier que le `STRAVA_CLIENT_ID` dans Vercel correspond bien à celui de votre application Strava
- Vérifier qu'il n'y a pas d'espaces ou de caractères invisibles dans la variable
- Vérifier que la Redirect URI dans Strava correspond exactement à celle utilisée

### Erreur : "redirect_uri_mismatch"

- Vérifier que la Redirect URI configurée dans Strava correspond exactement à celle utilisée
- Pour la production : `https://trackali-blush.vercel.app/auth/strava/callback`
- Pour le développement local : `http://localhost:5173/auth/strava/callback`
