CREATE TABLE public.hazard_zones (
  id text PRIMARY KEY,
  name text NOT NULL,
  disaster_type text NOT NULL,
  historical_risk_score double precision NOT NULL DEFAULT 0,
  sample_lat double precision NOT NULL,
  sample_lng double precision NOT NULL,
  on_river_channel boolean NOT NULL DEFAULT false,
  river_name text,
  flood_prone boolean NOT NULL DEFAULT false,
  slope_index double precision NOT NULL DEFAULT 0,
  soil_saturation double precision NOT NULL DEFAULT 0,
  live_rainfall_mm double precision,
  live_peak_wind_kmh double precision,
  live_min_pressure_hpa double precision,
  live_river_discharge_m3s double precision,
  live_landslide_risk double precision,
  live_source text,
  live_updated_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.hazard_zones TO anon, authenticated;
GRANT ALL ON public.hazard_zones TO service_role;
ALTER TABLE public.hazard_zones ENABLE ROW LEVEL SECURITY;
CREATE POLICY "hazard_zones public read" ON public.hazard_zones FOR SELECT USING (true);

CREATE TABLE public.data_source_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hazard_type text NOT NULL,
  source_used text NOT NULL,
  status text NOT NULL,
  zone_id text,
  message text,
  fetched_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.data_source_log TO anon, authenticated;
GRANT ALL ON public.data_source_log TO service_role;
ALTER TABLE public.data_source_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "data_source_log public read" ON public.data_source_log FOR SELECT USING (true);

CREATE INDEX data_source_log_recent_idx ON public.data_source_log (hazard_type, fetched_at DESC);

ALTER TABLE public.live_disasters
  ADD COLUMN external_id text,
  ADD COLUMN source text NOT NULL DEFAULT 'NDMA SACHET',
  ADD COLUMN mode text NOT NULL DEFAULT 'live';

CREATE UNIQUE INDEX live_disasters_external_id_key ON public.live_disasters (external_id) WHERE external_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER hazard_zones_updated_at
  BEFORE UPDATE ON public.hazard_zones
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.hazard_zones
  (id, name, disaster_type, historical_risk_score, sample_lat, sample_lng, on_river_channel, river_name, flood_prone, slope_index, soil_saturation)
VALUES
  ('HZ-FL-01', 'Mahanadi delta flood belt', 'flood', 0.87, 20.4700, 85.8800, true, 'Mahanadi', true, 0.08, 0.72),
  ('HZ-FL-02', 'Lower Ganga-Sundarbans flood belt', 'flood', 0.74, 22.3000, 88.1000, true, 'Hooghly', true, 0.05, 0.81),
  ('HZ-CY-01', 'Bay of Bengal cyclone-prone coastline', 'cyclone', 0.91, 20.9000, 86.9000, false, NULL, false, 0.04, 0.64),
  ('HZ-EQ-01', 'Kutch seismic zone V', 'earthquake', 0.83, 23.2500, 69.8000, false, NULL, false, 0.12, 0.21),
  ('HZ-LS-01', 'Garhwal Himalaya landslide belt', 'landslide', 0.79, 30.4000, 79.2000, false, NULL, false, 0.68, 0.55),
  ('HZ-LS-02', 'Western Ghats slope belt', 'landslide', 0.66, 11.6000, 76.2000, false, NULL, false, 0.52, 0.61);

INSERT INTO public.data_source_log (hazard_type, source_used, status, message)
VALUES
  ('earthquake', 'seed', 'ok', 'Seeded baseline data'),
  ('flood', 'seed', 'ok', 'Seeded baseline data'),
  ('cyclone', 'seed', 'ok', 'Seeded baseline data'),
  ('landslide', 'seed', 'ok', 'Seeded baseline data');