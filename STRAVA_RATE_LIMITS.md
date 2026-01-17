# Gestion des Rate Limits Strava

## Limites Strava

Strava impose des limites strictes sur l'utilisation de son API :

- **100 requêtes / 15 minutes** (pour les endpoints non-upload)
- **1000 requêtes / jour**
- **25 athlètes connectés maximum** (pour une app en développement)

## Problème rencontré

L'erreur `403 - limite de connexion atteinte` peut survenir pour plusieurs raisons :

1. **Trop de requêtes dans une fenêtre de 15 minutes** : Si l'app fait plus de 100 appels API en 15 minutes
2. **Limite quotidienne atteinte** : Si l'app a fait plus de 1000 requêtes dans la journée
3. **Limite d'athlètes connectés** : Si plus de 25 utilisateurs se sont connectés via l'app (en mode développement)

## Solutions implémentées

### 1. Cache amélioré
- Durée du cache augmentée de **5 minutes à 30 minutes** pour les métriques Strava
- Réduit significativement le nombre d'appels API

### 2. Limitation des pages récupérées
- Limite à **5 pages maximum** lors de la récupération des activités (1000 activités max au lieu de toutes)
- Évite les boucles infinies qui consomment trop de requêtes

### 3. Détection des rate limits
- Vérification des headers `X-RateLimit-Limit` et `X-RateLimit-Usage` dans les réponses Strava
- Arrêt automatique si on approche de 90% de la limite
- Gestion de l'erreur `429 Too Many Requests` avec message explicite

### 4. Tracking local des requêtes
- Nouveau module `stravaRateLimit.ts` pour tracker les requêtes côté client
- Empêche de faire des requêtes si on approche des limites

## Comment augmenter les quotas Strava

### Pour augmenter les limites d'API

1. **Soumettre une demande à Strava** :
   - Aller sur https://developers.strava.com
   - Remplir le formulaire "Developer Program Review"
   - Inclure :
     - L'ID de l'application Strava
     - Des captures d'écran montrant l'utilisation des données Strava
     - Le bouton "Connect with Strava" visible dans l'app
     - Des statistiques d'utilisation (nombre d'utilisateurs, etc.)

2. **Respecter les conditions** :
   - Lire et accepter les **API Terms**
   - Respecter les **Brand Guidelines** (logo, bouton "Connect with Strava")
   - Utiliser les webhooks au lieu du polling quand possible

3. **Optimiser avant la demande** :
   - Utiliser des webhooks pour les nouvelles activités
   - Mettre en cache les données historiques
   - Réduire la fréquence des appels API

### Pour augmenter la limite d'athlètes connectés

- Passer l'application en **production** sur le dashboard Strava
- Les apps en production n'ont pas de limite sur le nombre d'athlètes connectés

## Recommandations

1. **En développement** :
   - Utiliser un seul compte de test
   - Ne pas se reconnecter trop souvent
   - Attendre entre les tests

2. **En production** :
   - Implémenter un système de queue pour les requêtes API
   - Utiliser des webhooks Strava pour les nouvelles activités
   - Mettre en cache agressivement les données historiques
   - Surveiller les headers `X-RateLimit-*` dans toutes les réponses

3. **En cas d'erreur 403/429** :
   - Attendre 15 minutes avant de réessayer
   - Vérifier les logs pour identifier les appels excessifs
   - Réduire la fréquence des appels si nécessaire

## Surveillance

Pour surveiller l'utilisation de l'API :

```javascript
import { getRateLimitStats } from './lib/stravaRateLimit'

const stats = getRateLimitStats()
console.log(`Requêtes dans la fenêtre: ${stats.requestsInWindow}/90`)
console.log(`Requêtes aujourd'hui: ${stats.dailyCount}/1000`)
console.log(`Temps d'attente: ${stats.waitTime}ms`)
```

## Liens utiles

- [Documentation Strava Rate Limits](https://developers.strava.com/docs/rate-limits/)
- [Strava Developer Program](https://developers.strava.com)
- [Strava API Terms](https://www.strava.com/legal/api)
