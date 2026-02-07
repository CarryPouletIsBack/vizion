# Sécurité – Vizion

## RLS (Row Level Security) Supabase

- **`public.events`** : lecture seule (SELECT) pour tous. Pas d’INSERT/UPDATE/DELETE côté client → écriture réservée au service_role (dashboard / backend).
- **`public.courses`** : idem, lecture seule pour tous. Pas d’écriture côté client.
- **`public.user_fit_activities`** : chaque utilisateur ne peut que lire, insérer et supprimer ses propres lignes (`auth.uid() = user_id`).

Les clés utilisées côté frontend sont la **clé anon/publishable** uniquement ; la clé service_role n’est jamais exposée.

## Recommandation Supabase (Auth)

- **Leaked password protection** : activer la protection des mots de passe compromis (HaveIBeenPwned) dans le dashboard Supabase : [Documentation](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).

## Secrets et variables d’environnement

- Les secrets (Strava, XWeather, Mistral, etc.) sont utilisés côté **serveur** (Vite/API) via `process.env`, jamais en dur dans le frontend.
- Supabase : l’URL et la clé anon peuvent être définies via `VITE_SUPABASE_URL` et `VITE_SUPABASE_ANON_KEY` (voir `.env.example`). Le fichier `.env` est ignoré par Git.
