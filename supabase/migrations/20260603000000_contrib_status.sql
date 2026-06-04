-- Migrate contributions.status and initiatives.status from initiative_status enum to plain text.
-- Run this in the Supabase dashboard SQL Editor.

-- 1. contributions.status: enum → text
ALTER TABLE public.contributions
  ALTER COLUMN status TYPE text USING status::text;

-- 2. Remap contributions: Spanish enum values → English text
UPDATE public.contributions SET status = 'to_do'       WHERE status = 'planeado';
UPDATE public.contributions SET status = 'in_progress'  WHERE status = 'en_curso';
UPDATE public.contributions SET status = 'in_progress'  WHERE status = 'en_riesgo';
UPDATE public.contributions SET status = 'to_do'        WHERE status = 'bloqueado';
UPDATE public.contributions SET status = 'completed'    WHERE status = 'hecho';
ALTER TABLE public.contributions ALTER COLUMN status SET DEFAULT 'to_do';

-- 3. initiatives.status: enum → text
ALTER TABLE public.initiatives
  ALTER COLUMN status TYPE text USING status::text;

-- 4. Remap initiatives: Spanish enum values → English text
UPDATE public.initiatives SET status = 'to_do'      WHERE status = 'planeado';
UPDATE public.initiatives SET status = 'in_dev'     WHERE status = 'en_curso';
UPDATE public.initiatives SET status = 'in_dev'     WHERE status = 'en_riesgo';
UPDATE public.initiatives SET status = 'to_do'      WHERE status = 'bloqueado';
UPDATE public.initiatives SET status = 'completed'  WHERE status = 'hecho';
ALTER TABLE public.initiatives ALTER COLUMN status SET DEFAULT 'to_do';
