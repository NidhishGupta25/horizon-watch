CREATE TABLE public.warehouses (
  id text PRIMARY KEY,
  name text NOT NULL,
  lat double precision NOT NULL,
  lng double precision NOT NULL,
  status text NOT NULL DEFAULT 'operational',
  capacity integer NOT NULL DEFAULT 0,
  vehicles integer NOT NULL DEFAULT 0,
  food integer NOT NULL DEFAULT 0,
  water integer NOT NULL DEFAULT 0,
  medicine integer NOT NULL DEFAULT 0,
  shelter integer NOT NULL DEFAULT 0,
  boats integer NOT NULL DEFAULT 0,
  purification_tablets integer NOT NULL DEFAULT 0,
  last_updated timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.warehouses TO anon, authenticated;
GRANT ALL ON public.warehouses TO service_role;
ALTER TABLE public.warehouses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "warehouses public read" ON public.warehouses FOR SELECT TO anon, authenticated USING (true);

CREATE TABLE public.live_disasters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dedupe_hash text NOT NULL UNIQUE,
  title text NOT NULL,
  description text,
  pub_date timestamptz,
  hazard_type text NOT NULL,
  district text,
  state text,
  lat double precision,
  lng double precision,
  geocode_source text NOT NULL DEFAULT 'nominatim',
  severity text NOT NULL DEFAULT 'Moderate',
  dispatch_warehouse_id text REFERENCES public.warehouses(id),
  dispatch_distance_km double precision,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX live_disasters_pub_date_idx ON public.live_disasters (pub_date DESC NULLS LAST);
GRANT SELECT ON public.live_disasters TO anon, authenticated;
GRANT ALL ON public.live_disasters TO service_role;
ALTER TABLE public.live_disasters ENABLE ROW LEVEL SECURITY;
CREATE POLICY "live_disasters public read" ON public.live_disasters FOR SELECT TO anon, authenticated USING (true);

CREATE TABLE public.supply_dispatches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  disaster_id uuid NOT NULL REFERENCES public.live_disasters(id) ON DELETE CASCADE,
  warehouse_id text NOT NULL REFERENCES public.warehouses(id),
  item text NOT NULL,
  quantity integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.supply_dispatches TO anon, authenticated;
GRANT ALL ON public.supply_dispatches TO service_role;
ALTER TABLE public.supply_dispatches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "supply_dispatches public read" ON public.supply_dispatches FOR SELECT TO anon, authenticated USING (true);

CREATE TABLE public.ingestion_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ran_at timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL,
  items_seen integer NOT NULL DEFAULT 0,
  items_inserted integer NOT NULL DEFAULT 0,
  error text
);
GRANT SELECT ON public.ingestion_runs TO anon, authenticated;
GRANT ALL ON public.ingestion_runs TO service_role;
ALTER TABLE public.ingestion_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ingestion_runs public read" ON public.ingestion_runs FOR SELECT TO anon, authenticated USING (true);

INSERT INTO public.warehouses (id, name, lat, lng, status, capacity, vehicles, food, water, medicine, shelter, boats, purification_tablets) VALUES
('WH-01','Cuttack Central Depot',20.46,85.88,'operational',120000,24,38200,96500,11400,15200,120,48000),
('WH-02','Bhadrak Forward Store',21.06,86.50,'constrained',48000,8,9100,21000,2300,3100,40,12000),
('WH-03','Kolkata Regional Hub',22.57,88.36,'operational',160000,31,51800,132000,18600,22400,160,64000),
('WH-04','Rishikesh Hill Depot',30.09,78.27,'operational',36000,11,8600,19400,3900,4200,25,9000),
('WH-05','Gandhidham Store',23.08,70.13,'offline',52000,0,12300,28800,4100,5600,30,11000);