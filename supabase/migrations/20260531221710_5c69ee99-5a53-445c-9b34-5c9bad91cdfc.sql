-- 1. Add Sales area
INSERT INTO public.areas (key, name, color, order_index)
VALUES ('sales', 'Sales', '#DB2777', 5)
ON CONFLICT DO NOTHING;

-- 2. Add description and status to contributions
ALTER TABLE public.contributions
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS status initiative_status NOT NULL DEFAULT 'planeado';
