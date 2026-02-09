-- Bornes géographiques du GPX (pour affichage précis du tracé sur la carte OSM).
-- Exécuter une fois : SQL Editor > New query > coller > Run.

ALTER TABLE courses ADD COLUMN IF NOT EXISTS gpx_bounds jsonb;

COMMENT ON COLUMN courses.gpx_bounds IS 'Bornes {minLat, maxLat, minLon, maxLon} du tracé GPX pour placement précis sur la carte';
