-- Ajout des colonnes date et start_time à la table courses (pour départ officiel et simulation).
-- IMPORTANT : exécuter ce script une fois sur chaque projet Supabase (dev + prod).
-- Dans le Dashboard Supabase : SQL Editor > New query > coller le script > Run.

ALTER TABLE courses ADD COLUMN IF NOT EXISTS date text;
ALTER TABLE courses ADD COLUMN IF NOT EXISTS start_time text;

COMMENT ON COLUMN courses.date IS 'Date de la course (YYYY-MM-DD) pour météo et simulation';
COMMENT ON COLUMN courses.start_time IS 'Heure de départ (HH:mm) imposée par l''organisation';
