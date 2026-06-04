ALTER TABLE public.contributions DROP CONSTRAINT IF EXISTS contributions_initiative_id_area_id_key;
ALTER TABLE public.contributions ADD COLUMN IF NOT EXISTS title text;
CREATE INDEX IF NOT EXISTS contributions_initiative_area_idx ON public.contributions (initiative_id, area_id);