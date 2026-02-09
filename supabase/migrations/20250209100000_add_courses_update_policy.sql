-- Autoriser les utilisateurs authentifiés à mettre à jour et supprimer des courses.
-- Sans cette politique, RLS bloque toute requête UPDATE sur la table courses.

CREATE POLICY "Allow authenticated update on courses"
ON public.courses
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

CREATE POLICY "Allow authenticated delete on courses"
ON public.courses
FOR DELETE
TO authenticated
USING (true);
