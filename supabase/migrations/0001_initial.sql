-- =============================================================================
-- Almstead Product Costing — Initial Migration
-- =============================================================================

-- Branches
CREATE TABLE public.branches (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name                  text NOT NULL UNIQUE,
  state                 text NOT NULL,
  display_label         text NOT NULL,
  wc_rate               numeric(8,5) NOT NULL,
  pr_rate               numeric(8,5) NOT NULL,
  medical_per_hr        numeric(10,4) NOT NULL DEFAULT 0,
  overhead_per_hr       numeric(10,4) NOT NULL,
  storm_bonus_per_8h    numeric(10,2) NOT NULL DEFAULT 0,
  sort_order            int NOT NULL DEFAULT 0
);

-- Profiles (extends auth.users)
CREATE TABLE public.profiles (
  id              uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email           text NOT NULL UNIQUE,
  full_name       text,
  role            text NOT NULL CHECK (role IN ('sales', 'admin')) DEFAULT 'sales',
  default_branch  uuid REFERENCES public.branches(id),
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- Global assumptions (singleton: always row id = 1)
CREATE TABLE public.what_if (
  id                  int PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  profit_pct          numeric(6,4) NOT NULL DEFAULT 0.2500,
  contrib_margin_pct  numeric(6,4) NOT NULL DEFAULT 1.0000,
  fuel_per_gal        numeric(8,4) NOT NULL DEFAULT 5.50,
  emergency_mult      numeric(6,4) NOT NULL DEFAULT 2.0000,
  updated_at          timestamptz NOT NULL DEFAULT now(),
  updated_by          uuid REFERENCES public.profiles(id)
);

-- Labor classifications
CREATE TABLE public.classifications (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  label        text NOT NULL UNIQUE,
  emp_class    text NOT NULL,
  reg_wage     numeric(10,4) NOT NULL DEFAULT 0,
  reg_supp     numeric(10,4) NOT NULL DEFAULT 0,
  ot_wage      numeric(10,4) NOT NULL DEFAULT 0,
  ot_supp      numeric(10,4) NOT NULL DEFAULT 0,
  description  text,
  sort_order   int NOT NULL DEFAULT 0
);

-- Employees
CREATE TABLE public.employees (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id             uuid NOT NULL REFERENCES public.branches(id) ON DELETE RESTRICT,
  emp_no                text NOT NULL,
  classification        text NOT NULL,
  last_name             text NOT NULL,
  first_name            text NOT NULL,
  pay_per_hr            numeric(10,4) NOT NULL,
  supplemental_per_hr   numeric(10,4) NOT NULL DEFAULT 0,
  active                boolean NOT NULL DEFAULT true,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  UNIQUE (branch_id, emp_no)
);
CREATE INDEX ON employees (branch_id, classification);

-- Equipment
CREATE TABLE public.equipment (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  truck_number          text NOT NULL UNIQUE,
  equipment_name        text NOT NULL,
  fuel_gph              numeric(8,4) NOT NULL DEFAULT 0,
  annual_maint          numeric(12,2) NOT NULL DEFAULT 0,
  annual_lic            numeric(12,2) NOT NULL DEFAULT 0,
  days_used_per_year    int NOT NULL DEFAULT 220,
  active                boolean NOT NULL DEFAULT true,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON equipment (active);

-- Labor selections (per-branch pinned employees)
CREATE TABLE public.labor_selections (
  branch_id            uuid NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  classification_label text NOT NULL,
  selection            text NOT NULL DEFAULT 'AVG',
  updated_at           timestamptz NOT NULL DEFAULT now(),
  updated_by           uuid REFERENCES public.profiles(id),
  PRIMARY KEY (branch_id, classification_label)
);

-- Saved bids
CREATE TABLE public.bids (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by    uuid NOT NULL REFERENCES public.profiles(id),
  branch_id     uuid NOT NULL REFERENCES public.branches(id),
  name          text NOT NULL,
  client_name   text,
  notes         text,
  mode          text NOT NULL CHECK (mode IN ('reg', 'ot')),
  config        jsonb NOT NULL,
  snapshot      jsonb NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON bids (created_by, created_at DESC);
CREATE INDEX ON bids (branch_id, created_at DESC);

-- Audit log
CREATE TABLE public.audit_log (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id    uuid REFERENCES public.profiles(id),
  action      text NOT NULL,
  table_name  text,
  row_id      uuid,
  before      jsonb,
  after       jsonb,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON audit_log (created_at DESC);

-- =============================================================================
-- Row-Level Security
-- =============================================================================

ALTER TABLE profiles          ENABLE ROW LEVEL SECURITY;
ALTER TABLE what_if           ENABLE ROW LEVEL SECURITY;
ALTER TABLE classifications   ENABLE ROW LEVEL SECURITY;
ALTER TABLE branches          ENABLE ROW LEVEL SECURITY;
ALTER TABLE employees         ENABLE ROW LEVEL SECURITY;
ALTER TABLE equipment         ENABLE ROW LEVEL SECURITY;
ALTER TABLE labor_selections  ENABLE ROW LEVEL SECURITY;
ALTER TABLE bids              ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log         ENABLE ROW LEVEL SECURITY;

-- Helper: check current user is admin
CREATE OR REPLACE FUNCTION public.is_admin() RETURNS boolean
LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
$$;

-- Profiles
CREATE POLICY "read_own_profile" ON profiles
  FOR SELECT USING (id = auth.uid() OR public.is_admin());
CREATE POLICY "update_own_profile" ON profiles
  FOR UPDATE USING (id = auth.uid());

-- Reference tables: any authenticated reads; only admins write
CREATE POLICY "read_what_if" ON what_if
  FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "write_what_if" ON what_if
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "read_classifications" ON classifications
  FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "write_classifications" ON classifications
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "read_branches" ON branches
  FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "write_branches" ON branches
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "read_employees" ON employees
  FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "write_employees" ON employees
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "read_equipment" ON equipment
  FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "write_equipment" ON equipment
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "read_labor_selections" ON labor_selections
  FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "write_labor_selections" ON labor_selections
  FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');

-- Bids: users see and edit their own; admins see all
CREATE POLICY "read_own_bids" ON bids
  FOR SELECT USING (created_by = auth.uid() OR public.is_admin());
CREATE POLICY "insert_own_bids" ON bids
  FOR INSERT WITH CHECK (created_by = auth.uid());
CREATE POLICY "update_own_bids" ON bids
  FOR UPDATE USING (created_by = auth.uid() OR public.is_admin());
CREATE POLICY "delete_own_bids" ON bids
  FOR DELETE USING (created_by = auth.uid() OR public.is_admin());

-- Audit log: read by admins only
CREATE POLICY "read_audit" ON audit_log
  FOR SELECT USING (public.is_admin());

-- =============================================================================
-- Triggers
-- =============================================================================

CREATE OR REPLACE FUNCTION public.set_updated_at() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at := now(); RETURN NEW; END;
$$;

CREATE TRIGGER trg_employees_updated BEFORE UPDATE ON employees
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();
CREATE TRIGGER trg_equipment_updated BEFORE UPDATE ON equipment
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();
CREATE TRIGGER trg_bids_updated BEFORE UPDATE ON bids
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();
CREATE TRIGGER trg_labor_sel_updated BEFORE UPDATE ON labor_selections
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();

-- First-time user trigger
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (new.id, new.email,
          coalesce(new.raw_user_meta_data->>'full_name', ''),
          'sales');
  RETURN new;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- =============================================================================
-- Realtime
-- =============================================================================

ALTER PUBLICATION supabase_realtime ADD TABLE what_if;
ALTER PUBLICATION supabase_realtime ADD TABLE classifications;
ALTER PUBLICATION supabase_realtime ADD TABLE branches;
ALTER PUBLICATION supabase_realtime ADD TABLE employees;
ALTER PUBLICATION supabase_realtime ADD TABLE equipment;
ALTER PUBLICATION supabase_realtime ADD TABLE labor_selections;

-- =============================================================================
-- SEED DATA
-- =============================================================================

-- =====================================================
-- SEED DATA from Product_Costing_worksheets_2026
-- Generated from Excel workbook on 2026-06-01
-- =====================================================

-- Branches
INSERT INTO public.branches (id, name, state, display_label, wc_rate, pr_rate, medical_per_hr, overhead_per_hr, storm_bonus_per_8h, sort_order) VALUES ('7c624a53-1c95-4119-bb5a-7b6cf46ee62a', 'New Rochelle', 'NY', 'NEW ROCHELLE NY BRANCH', 0.0617, 0.1226, 0, 48.06, 0, 1);
INSERT INTO public.branches (id, name, state, display_label, wc_rate, pr_rate, medical_per_hr, overhead_per_hr, storm_bonus_per_8h, sort_order) VALUES ('2220f69b-f3c3-40aa-9d0b-236545d53ea4', 'Hawthorne', 'NY', 'HAWTHORNE NY BRANCH', 0.0617, 0.1544, 0, 43.8, 0, 2);
INSERT INTO public.branches (id, name, state, display_label, wc_rate, pr_rate, medical_per_hr, overhead_per_hr, storm_bonus_per_8h, sort_order) VALUES ('835ed1c2-4d43-422b-9da0-2bd51f04214b', 'Stamford', 'CT', 'STAMFORD CONNECTICUT BRANCH', 0.0526, 0.1712, 0, 41.13, 0, 3);
INSERT INTO public.branches (id, name, state, display_label, wc_rate, pr_rate, medical_per_hr, overhead_per_hr, storm_bonus_per_8h, sort_order) VALUES ('bfb6250e-8636-4ca3-b8fa-01a6e1edfd32', 'North Haledon', 'NJ', 'NORTH HALEDON NJ BRANCH', 0.1053, 0.2131, 0, 49.66, 0, 4);

-- Classifications
INSERT INTO public.classifications (id, label, emp_class, reg_wage, reg_supp, ot_wage, ot_supp, description, sort_order) VALUES (gen_random_uuid(), 'Foreman', 'Foreman', 50.29, 29.13, 75.435, 29.13, 'Westchester Heavy & Highway GR III', 1);
INSERT INTO public.classifications (id, label, emp_class, reg_wage, reg_supp, ot_wage, ot_supp, description, sort_order) VALUES (gen_random_uuid(), 'Climber', 'Climber', 50.29, 29.13, 75.435, 29.13, 'Westchester Heavy & Highway GR III', 2);
INSERT INTO public.classifications (id, label, emp_class, reg_wage, reg_supp, ot_wage, ot_supp, description, sort_order) VALUES (gen_random_uuid(), 'Groundman', 'Groundperson', 49.56, 29.13, 74.34, 29.13, 'Westchester Heavy & Highway GR V', 3);
INSERT INTO public.classifications (id, label, emp_class, reg_wage, reg_supp, ot_wage, ot_supp, description, sort_order) VALUES (gen_random_uuid(), 'Other-1', 'Spray Tech', 0, 0, 0, 0, 'PHC Spray Tech (non-certified)', 4);
INSERT INTO public.classifications (id, label, emp_class, reg_wage, reg_supp, ot_wage, ot_supp, description, sort_order) VALUES (gen_random_uuid(), 'Other-2', 'Lawn Tech', 0, 0, 0, 0, 'Lawn Tech (non-certified)', 5);

-- What If Conditions (singleton)
INSERT INTO public.what_if (id, profit_pct, contrib_margin_pct, fuel_per_gal, emergency_mult) VALUES (1, 0.2500, 1.0000, 5.50, 2.0000);

-- Employees
-- Total: 75 employees across 4 branches
INSERT INTO public.employees (id, branch_id, emp_no, classification, last_name, first_name, pay_per_hr, supplemental_per_hr) VALUES (gen_random_uuid(), '2220f69b-f3c3-40aa-9d0b-236545d53ea4', '000073', 'Foreman', 'ALCANTAR', 'CARLOS', 43.0, 5.71);
INSERT INTO public.employees (id, branch_id, emp_no, classification, last_name, first_name, pay_per_hr, supplemental_per_hr) VALUES (gen_random_uuid(), '2220f69b-f3c3-40aa-9d0b-236545d53ea4', '000070', 'Climber', 'ALCANTAR', 'JOSE', 20.0, 2.89);
INSERT INTO public.employees (id, branch_id, emp_no, classification, last_name, first_name, pay_per_hr, supplemental_per_hr) VALUES (gen_random_uuid(), '2220f69b-f3c3-40aa-9d0b-236545d53ea4', '001356', 'Lawn Tech', 'ALCANTAR', 'EFREN', 22.0, 1.47);
INSERT INTO public.employees (id, branch_id, emp_no, classification, last_name, first_name, pay_per_hr, supplemental_per_hr) VALUES (gen_random_uuid(), '2220f69b-f3c3-40aa-9d0b-236545d53ea4', '001542', 'Climber', 'ALMADA ZORRILLA', 'MARCOS', 35.0, 2.33);
INSERT INTO public.employees (id, branch_id, emp_no, classification, last_name, first_name, pay_per_hr, supplemental_per_hr) VALUES (gen_random_uuid(), '2220f69b-f3c3-40aa-9d0b-236545d53ea4', '000077', 'Foreman', 'LICEA', 'ANTONIO', 29.0, 2.64);
INSERT INTO public.employees (id, branch_id, emp_no, classification, last_name, first_name, pay_per_hr, supplemental_per_hr) VALUES (gen_random_uuid(), '2220f69b-f3c3-40aa-9d0b-236545d53ea4', '001553', 'Climber', 'ARAGON MORENO', 'VALENTIN', 37.0, 2.47);
INSERT INTO public.employees (id, branch_id, emp_no, classification, last_name, first_name, pay_per_hr, supplemental_per_hr) VALUES (gen_random_uuid(), '2220f69b-f3c3-40aa-9d0b-236545d53ea4', '001297', 'Spray Tech', 'CASTILLO SOLIS', 'JAVIER', 31.0, 2.14);
INSERT INTO public.employees (id, branch_id, emp_no, classification, last_name, first_name, pay_per_hr, supplemental_per_hr) VALUES (gen_random_uuid(), '2220f69b-f3c3-40aa-9d0b-236545d53ea4', '000110', 'Lawn Tech', 'ANDREWS', 'KEVIN', 39.0, 5.27);
INSERT INTO public.employees (id, branch_id, emp_no, classification, last_name, first_name, pay_per_hr, supplemental_per_hr) VALUES (gen_random_uuid(), '2220f69b-f3c3-40aa-9d0b-236545d53ea4', '000098', 'Climber', 'VERA', 'ROQUE', 25.0, 2.39);
INSERT INTO public.employees (id, branch_id, emp_no, classification, last_name, first_name, pay_per_hr, supplemental_per_hr) VALUES (gen_random_uuid(), '2220f69b-f3c3-40aa-9d0b-236545d53ea4', '001573', 'Spray Tech', 'CASTILLO', 'JAVIER (JAVIE)', 18.0, 1.2);
INSERT INTO public.employees (id, branch_id, emp_no, classification, last_name, first_name, pay_per_hr, supplemental_per_hr) VALUES (gen_random_uuid(), '2220f69b-f3c3-40aa-9d0b-236545d53ea4', '001268', 'Groundperson', 'ESCOTO JR', 'OSIRIS', 17.5, 3.72);
INSERT INTO public.employees (id, branch_id, emp_no, classification, last_name, first_name, pay_per_hr, supplemental_per_hr) VALUES (gen_random_uuid(), '2220f69b-f3c3-40aa-9d0b-236545d53ea4', '000102', 'Groundperson', 'GOMEZ', 'MARTIN', 21.0, 1.94);
INSERT INTO public.employees (id, branch_id, emp_no, classification, last_name, first_name, pay_per_hr, supplemental_per_hr) VALUES (gen_random_uuid(), '2220f69b-f3c3-40aa-9d0b-236545d53ea4', '001520', 'Climber', 'LOPEZ CARMONA', 'SILVESTRE', 37.0, 2.29);
INSERT INTO public.employees (id, branch_id, emp_no, classification, last_name, first_name, pay_per_hr, supplemental_per_hr) VALUES (gen_random_uuid(), '2220f69b-f3c3-40aa-9d0b-236545d53ea4', '001375', 'Climber', 'MONGES', 'LUIS', 23.0, 1.76);
INSERT INTO public.employees (id, branch_id, emp_no, classification, last_name, first_name, pay_per_hr, supplemental_per_hr) VALUES (gen_random_uuid(), '7c624a53-1c95-4119-bb5a-7b6cf46ee62a', '001298', 'Climber', 'CUEVAS', 'JOSE', 29.0, 2.32);
INSERT INTO public.employees (id, branch_id, emp_no, classification, last_name, first_name, pay_per_hr, supplemental_per_hr) VALUES (gen_random_uuid(), '7c624a53-1c95-4119-bb5a-7b6cf46ee62a', '000056', 'Foreman', 'FLORES', 'ALEJANDRO', 37.0, 4.83);
INSERT INTO public.employees (id, branch_id, emp_no, classification, last_name, first_name, pay_per_hr, supplemental_per_hr) VALUES (gen_random_uuid(), '7c624a53-1c95-4119-bb5a-7b6cf46ee62a', '001362', 'Climber', 'ROSA', 'ALEX', 32.0, 3.04);
INSERT INTO public.employees (id, branch_id, emp_no, classification, last_name, first_name, pay_per_hr, supplemental_per_hr) VALUES (gen_random_uuid(), '7c624a53-1c95-4119-bb5a-7b6cf46ee62a', '000100', 'Climber', 'TORRES', 'JOSE', 32.0, 1.81);
INSERT INTO public.employees (id, branch_id, emp_no, classification, last_name, first_name, pay_per_hr, supplemental_per_hr) VALUES (gen_random_uuid(), '7c624a53-1c95-4119-bb5a-7b6cf46ee62a', '000051', 'Operations Manager', 'SOLORIO BEJINES', 'ANTONIO', 60.1, 11.93);
INSERT INTO public.employees (id, branch_id, emp_no, classification, last_name, first_name, pay_per_hr, supplemental_per_hr) VALUES (gen_random_uuid(), '7c624a53-1c95-4119-bb5a-7b6cf46ee62a', '001378', 'Groundperson', 'GALDAMEZ', 'RICARDO JAVIER', 24.0, 1.6);
INSERT INTO public.employees (id, branch_id, emp_no, classification, last_name, first_name, pay_per_hr, supplemental_per_hr) VALUES (gen_random_uuid(), '7c624a53-1c95-4119-bb5a-7b6cf46ee62a', '000059', 'Groundperson', 'OLIVEROS', 'JOSE', 17.0, 1.89);
INSERT INTO public.employees (id, branch_id, emp_no, classification, last_name, first_name, pay_per_hr, supplemental_per_hr) VALUES (gen_random_uuid(), '7c624a53-1c95-4119-bb5a-7b6cf46ee62a', '000054', 'Groundperson', 'BARAJAS', 'ANTONIO', 28.0, 4.09);
INSERT INTO public.employees (id, branch_id, emp_no, classification, last_name, first_name, pay_per_hr, supplemental_per_hr) VALUES (gen_random_uuid(), '7c624a53-1c95-4119-bb5a-7b6cf46ee62a', '001591', 'Foreman', 'MEZA CASTRO', 'JESUS', 36.0, 2.4);
INSERT INTO public.employees (id, branch_id, emp_no, classification, last_name, first_name, pay_per_hr, supplemental_per_hr) VALUES (gen_random_uuid(), '7c624a53-1c95-4119-bb5a-7b6cf46ee62a', '001458', 'Climber', 'SUY', 'ELMAR', 32.0, 1.77);
INSERT INTO public.employees (id, branch_id, emp_no, classification, last_name, first_name, pay_per_hr, supplemental_per_hr) VALUES (gen_random_uuid(), '7c624a53-1c95-4119-bb5a-7b6cf46ee62a', '000053', 'Foreman', 'BARAJAS', 'RAUL', 35.0, 4.73);
INSERT INTO public.employees (id, branch_id, emp_no, classification, last_name, first_name, pay_per_hr, supplemental_per_hr) VALUES (gen_random_uuid(), '7c624a53-1c95-4119-bb5a-7b6cf46ee62a', '001338', 'Climber', 'TELLES', 'GUSTAVO', 31.0, 2.76);
INSERT INTO public.employees (id, branch_id, emp_no, classification, last_name, first_name, pay_per_hr, supplemental_per_hr) VALUES (gen_random_uuid(), '7c624a53-1c95-4119-bb5a-7b6cf46ee62a', '001225', 'Lawn Tech', 'CUEVAS', 'LUIS', 25.0, 2.17);
INSERT INTO public.employees (id, branch_id, emp_no, classification, last_name, first_name, pay_per_hr, supplemental_per_hr) VALUES (gen_random_uuid(), '7c624a53-1c95-4119-bb5a-7b6cf46ee62a', '000108', 'Foreman', 'ROSA', 'HUGO', 37.0, 3.19);
INSERT INTO public.employees (id, branch_id, emp_no, classification, last_name, first_name, pay_per_hr, supplemental_per_hr) VALUES (gen_random_uuid(), '7c624a53-1c95-4119-bb5a-7b6cf46ee62a', '000064', 'Climber', 'GALVEZ', 'JORGE', 35.0, 3.89);
INSERT INTO public.employees (id, branch_id, emp_no, classification, last_name, first_name, pay_per_hr, supplemental_per_hr) VALUES (gen_random_uuid(), '7c624a53-1c95-4119-bb5a-7b6cf46ee62a', '000177', 'Groundperson', 'VALDOVINOS', 'RICARDO', 29.0, 2.04);
INSERT INTO public.employees (id, branch_id, emp_no, classification, last_name, first_name, pay_per_hr, supplemental_per_hr) VALUES (gen_random_uuid(), '7c624a53-1c95-4119-bb5a-7b6cf46ee62a', '000058', 'Spray Tech', 'MARTINEZ', 'CESAR', 28.0, 2.56);
INSERT INTO public.employees (id, branch_id, emp_no, classification, last_name, first_name, pay_per_hr, supplemental_per_hr) VALUES (gen_random_uuid(), '7c624a53-1c95-4119-bb5a-7b6cf46ee62a', '001559', 'Spray Tech', 'DELGADO', 'ESTEBAN', 20.0, 1.33);
INSERT INTO public.employees (id, branch_id, emp_no, classification, last_name, first_name, pay_per_hr, supplemental_per_hr) VALUES (gen_random_uuid(), '7c624a53-1c95-4119-bb5a-7b6cf46ee62a', '000097', 'Groundperson', 'ROSA', 'MIGUEL', 26.0, 2.35);
INSERT INTO public.employees (id, branch_id, emp_no, classification, last_name, first_name, pay_per_hr, supplemental_per_hr) VALUES (gen_random_uuid(), '7c624a53-1c95-4119-bb5a-7b6cf46ee62a', '001592', 'Groundperson', 'LORENZO OGANDO', 'FRANCISCO', 25.0, 1.67);
INSERT INTO public.employees (id, branch_id, emp_no, classification, last_name, first_name, pay_per_hr, supplemental_per_hr) VALUES (gen_random_uuid(), '7c624a53-1c95-4119-bb5a-7b6cf46ee62a', '001208', 'Spray Tech', 'NAJERA', 'OSCAR', 32.0, 5.37);
INSERT INTO public.employees (id, branch_id, emp_no, classification, last_name, first_name, pay_per_hr, supplemental_per_hr) VALUES (gen_random_uuid(), '7c624a53-1c95-4119-bb5a-7b6cf46ee62a', '000061', 'Spray Tech', 'IBARRA', 'LEOBARDO', 37.0, 6.8);
INSERT INTO public.employees (id, branch_id, emp_no, classification, last_name, first_name, pay_per_hr, supplemental_per_hr) VALUES (gen_random_uuid(), '7c624a53-1c95-4119-bb5a-7b6cf46ee62a', '000052', 'Spray Tech', 'MARTINEZ', 'FEDERICO', 35.0, 3.89);
INSERT INTO public.employees (id, branch_id, emp_no, classification, last_name, first_name, pay_per_hr, supplemental_per_hr) VALUES (gen_random_uuid(), '7c624a53-1c95-4119-bb5a-7b6cf46ee62a', '000062', 'Foreman', 'SANCHEZ', 'JOSE MARIA', 37.0, 3.29);
INSERT INTO public.employees (id, branch_id, emp_no, classification, last_name, first_name, pay_per_hr, supplemental_per_hr) VALUES (gen_random_uuid(), '7c624a53-1c95-4119-bb5a-7b6cf46ee62a', '001537', 'Spray Tech', 'VIDAL', 'ENRIQUE', 25.0, 1.67);
INSERT INTO public.employees (id, branch_id, emp_no, classification, last_name, first_name, pay_per_hr, supplemental_per_hr) VALUES (gen_random_uuid(), '7c624a53-1c95-4119-bb5a-7b6cf46ee62a', '000115', 'Climber', 'RABANELES', 'AURELIO', 31.0, 3.4);
INSERT INTO public.employees (id, branch_id, emp_no, classification, last_name, first_name, pay_per_hr, supplemental_per_hr) VALUES (gen_random_uuid(), '7c624a53-1c95-4119-bb5a-7b6cf46ee62a', '001321', 'Groundperson', 'VASQUEZ', 'ERIC', 25.0, 1.67);
INSERT INTO public.employees (id, branch_id, emp_no, classification, last_name, first_name, pay_per_hr, supplemental_per_hr) VALUES (gen_random_uuid(), '7c624a53-1c95-4119-bb5a-7b6cf46ee62a', '001227', 'Foreman', 'ALVAREZ', 'BELISARIO', 40.0, 2.91);
INSERT INTO public.employees (id, branch_id, emp_no, classification, last_name, first_name, pay_per_hr, supplemental_per_hr) VALUES (gen_random_uuid(), '7c624a53-1c95-4119-bb5a-7b6cf46ee62a', '001279', 'Groundperson', 'NUNEZ', 'EDY', 24.0, 1.68);
INSERT INTO public.employees (id, branch_id, emp_no, classification, last_name, first_name, pay_per_hr, supplemental_per_hr) VALUES (gen_random_uuid(), '7c624a53-1c95-4119-bb5a-7b6cf46ee62a', '001291', 'Groundperson', 'ROSA ALMAZAN', 'VICTOR', 17.0, 1.41);
INSERT INTO public.employees (id, branch_id, emp_no, classification, last_name, first_name, pay_per_hr, supplemental_per_hr) VALUES (gen_random_uuid(), '7c624a53-1c95-4119-bb5a-7b6cf46ee62a', '001294', 'Foreman', 'FLORES', 'JAMIE', 30.0, 4.21);
INSERT INTO public.employees (id, branch_id, emp_no, classification, last_name, first_name, pay_per_hr, supplemental_per_hr) VALUES (gen_random_uuid(), '7c624a53-1c95-4119-bb5a-7b6cf46ee62a', '000057', 'Nursery- Field', 'CRUZ LOYOLA', 'JULIO', 24.0, 1.07);
INSERT INTO public.employees (id, branch_id, emp_no, classification, last_name, first_name, pay_per_hr, supplemental_per_hr) VALUES (gen_random_uuid(), '7c624a53-1c95-4119-bb5a-7b6cf46ee62a', '000055', 'Nursery- Field', 'CRUZ LOYOLA', 'CHARLI', 24.0, 1.49);
INSERT INTO public.employees (id, branch_id, emp_no, classification, last_name, first_name, pay_per_hr, supplemental_per_hr) VALUES (gen_random_uuid(), '7c624a53-1c95-4119-bb5a-7b6cf46ee62a', '000110', 'Nursery- Mulch Yard', 'QUIJANO', 'RICHARD', 25.0, 1.67);
INSERT INTO public.employees (id, branch_id, emp_no, classification, last_name, first_name, pay_per_hr, supplemental_per_hr) VALUES (gen_random_uuid(), '7c624a53-1c95-4119-bb5a-7b6cf46ee62a', '000109', 'Nursery- Driver', 'PIPPO', 'ROSSANO', 30.0, 2.67);
INSERT INTO public.employees (id, branch_id, emp_no, classification, last_name, first_name, pay_per_hr, supplemental_per_hr) VALUES (gen_random_uuid(), '835ed1c2-4d43-422b-9da0-2bd51f04214b', '001377', 'Climber', 'CAMEY', 'HUMBERTO', 28.0, 2.01);
INSERT INTO public.employees (id, branch_id, emp_no, classification, last_name, first_name, pay_per_hr, supplemental_per_hr) VALUES (gen_random_uuid(), '835ed1c2-4d43-422b-9da0-2bd51f04214b', '000089', 'Spray Tech', 'CHRISTOFORO', 'MARK', 34.0, 8.19);
INSERT INTO public.employees (id, branch_id, emp_no, classification, last_name, first_name, pay_per_hr, supplemental_per_hr) VALUES (gen_random_uuid(), '835ed1c2-4d43-422b-9da0-2bd51f04214b', '001497', 'Climber', 'BONILLA', 'ALBERTH', 29.0, 1.75);
INSERT INTO public.employees (id, branch_id, emp_no, classification, last_name, first_name, pay_per_hr, supplemental_per_hr) VALUES (gen_random_uuid(), '835ed1c2-4d43-422b-9da0-2bd51f04214b', '001440', 'Lawn Tech', 'JAGNARINE', 'RAMLALL', 34.0, 4.24);
INSERT INTO public.employees (id, branch_id, emp_no, classification, last_name, first_name, pay_per_hr, supplemental_per_hr) VALUES (gen_random_uuid(), '835ed1c2-4d43-422b-9da0-2bd51f04214b', '000093', 'Lawn Tech', 'FINNEY', 'MICHAEL', 36.0, 5.97);
INSERT INTO public.employees (id, branch_id, emp_no, classification, last_name, first_name, pay_per_hr, supplemental_per_hr) VALUES (gen_random_uuid(), '835ed1c2-4d43-422b-9da0-2bd51f04214b', '000109', 'Climber', 'LOPEZ', 'ENDER', 36.0, 4.54);
INSERT INTO public.employees (id, branch_id, emp_no, classification, last_name, first_name, pay_per_hr, supplemental_per_hr) VALUES (gen_random_uuid(), '835ed1c2-4d43-422b-9da0-2bd51f04214b', '000057', 'Foreman', 'PEREZ', 'MIGUEL', 41.0, 8.14);
INSERT INTO public.employees (id, branch_id, emp_no, classification, last_name, first_name, pay_per_hr, supplemental_per_hr) VALUES (gen_random_uuid(), '835ed1c2-4d43-422b-9da0-2bd51f04214b', '001319', 'Foreman', 'LAINEZ', 'HERNAN', 35.0, 5.23);
INSERT INTO public.employees (id, branch_id, emp_no, classification, last_name, first_name, pay_per_hr, supplemental_per_hr) VALUES (gen_random_uuid(), '835ed1c2-4d43-422b-9da0-2bd51f04214b', '001241', 'Foreman', 'HUERTAS LOPEZ', 'JORGE', 37.0, 2.66);
INSERT INTO public.employees (id, branch_id, emp_no, classification, last_name, first_name, pay_per_hr, supplemental_per_hr) VALUES (gen_random_uuid(), '835ed1c2-4d43-422b-9da0-2bd51f04214b', '001415', 'Foreman', 'LARA', 'VICTOR', 37.0, 3.29);
INSERT INTO public.employees (id, branch_id, emp_no, classification, last_name, first_name, pay_per_hr, supplemental_per_hr) VALUES (gen_random_uuid(), '835ed1c2-4d43-422b-9da0-2bd51f04214b', '001390', 'Climber', 'LARA ZUNIGA', 'JHONSON', 28.0, 2.2);
INSERT INTO public.employees (id, branch_id, emp_no, classification, last_name, first_name, pay_per_hr, supplemental_per_hr) VALUES (gen_random_uuid(), '835ed1c2-4d43-422b-9da0-2bd51f04214b', '001543', 'Groundperson', 'ORTEZ RAMIREZ', 'LESTER', 24.0, 1.6);
INSERT INTO public.employees (id, branch_id, emp_no, classification, last_name, first_name, pay_per_hr, supplemental_per_hr) VALUES (gen_random_uuid(), '835ed1c2-4d43-422b-9da0-2bd51f04214b', '001513', 'Groundperson', 'OLIVARES', 'LUIS', 22.0, 1.47);
INSERT INTO public.employees (id, branch_id, emp_no, classification, last_name, first_name, pay_per_hr, supplemental_per_hr) VALUES (gen_random_uuid(), '835ed1c2-4d43-422b-9da0-2bd51f04214b', '001418', 'Climber', 'ORTEGA', 'SERGIO', 27.0, 1.8);
INSERT INTO public.employees (id, branch_id, emp_no, classification, last_name, first_name, pay_per_hr, supplemental_per_hr) VALUES (gen_random_uuid(), '835ed1c2-4d43-422b-9da0-2bd51f04214b', '001567', 'Groundperson', 'PEREZ A', 'MIGUEL', 23.0, 1.53);
INSERT INTO public.employees (id, branch_id, emp_no, classification, last_name, first_name, pay_per_hr, supplemental_per_hr) VALUES (gen_random_uuid(), '835ed1c2-4d43-422b-9da0-2bd51f04214b', '001568', 'Spray Tech', 'SANTACRUZ', 'OSCAR', 32.0, 2.13);
INSERT INTO public.employees (id, branch_id, emp_no, classification, last_name, first_name, pay_per_hr, supplemental_per_hr) VALUES (gen_random_uuid(), '835ed1c2-4d43-422b-9da0-2bd51f04214b', '000074', 'Climber', 'SANTIAGO', 'GERARDO', 29.0, 3.01);
INSERT INTO public.employees (id, branch_id, emp_no, classification, last_name, first_name, pay_per_hr, supplemental_per_hr) VALUES (gen_random_uuid(), 'bfb6250e-8636-4ca3-b8fa-01a6e1edfd32', '000065', 'Foreman', 'CORONA', 'AMADOR', 34.5, 3.48);
INSERT INTO public.employees (id, branch_id, emp_no, classification, last_name, first_name, pay_per_hr, supplemental_per_hr) VALUES (gen_random_uuid(), 'bfb6250e-8636-4ca3-b8fa-01a6e1edfd32', '001465', 'Groundperson', 'ANGUIANO', 'IVAN', 24.0, 1.67);
INSERT INTO public.employees (id, branch_id, emp_no, classification, last_name, first_name, pay_per_hr, supplemental_per_hr) VALUES (gen_random_uuid(), 'bfb6250e-8636-4ca3-b8fa-01a6e1edfd32', '001540', 'Groundperson', 'CABALLERO', 'JULIETA', 21.0, 1.4);
INSERT INTO public.employees (id, branch_id, emp_no, classification, last_name, first_name, pay_per_hr, supplemental_per_hr) VALUES (gen_random_uuid(), 'bfb6250e-8636-4ca3-b8fa-01a6e1edfd32', '001576', 'Lawn Tech', 'JEAN BAPTISTE', 'LOVENS', 28.0, 1.87);
INSERT INTO public.employees (id, branch_id, emp_no, classification, last_name, first_name, pay_per_hr, supplemental_per_hr) VALUES (gen_random_uuid(), 'bfb6250e-8636-4ca3-b8fa-01a6e1edfd32', '000101', 'Spray Tech', 'HURLEY', 'JAMES', 35.0, 3.11);
INSERT INTO public.employees (id, branch_id, emp_no, classification, last_name, first_name, pay_per_hr, supplemental_per_hr) VALUES (gen_random_uuid(), 'bfb6250e-8636-4ca3-b8fa-01a6e1edfd32', '000071', 'Foreman', 'ANGUIANO', 'SERGIO', 40.0, 5.88);
INSERT INTO public.employees (id, branch_id, emp_no, classification, last_name, first_name, pay_per_hr, supplemental_per_hr) VALUES (gen_random_uuid(), 'bfb6250e-8636-4ca3-b8fa-01a6e1edfd32', '001569', 'Climber', 'LLERA', 'SIMON', 30.0, 2.0);
INSERT INTO public.employees (id, branch_id, emp_no, classification, last_name, first_name, pay_per_hr, supplemental_per_hr) VALUES (gen_random_uuid(), 'bfb6250e-8636-4ca3-b8fa-01a6e1edfd32', '000060', 'Climber', 'OLIVERA', 'JOSE', 32.0, 2.67);
INSERT INTO public.employees (id, branch_id, emp_no, classification, last_name, first_name, pay_per_hr, supplemental_per_hr) VALUES (gen_random_uuid(), 'bfb6250e-8636-4ca3-b8fa-01a6e1edfd32', '000166', 'Groundperson', 'ROSAS', 'CARLOS', 23.0, 1.79);

-- Equipment Fleet
-- Total: 203 assets
INSERT INTO public.equipment (id, truck_number, equipment_name, fuel_gph, annual_maint, annual_lic, days_used_per_year) VALUES (gen_random_uuid(), '40', 'Tractor', 4.5, 21621.38, 1327.25, 220);
INSERT INTO public.equipment (id, truck_number, equipment_name, fuel_gph, annual_maint, annual_lic, days_used_per_year) VALUES (gen_random_uuid(), '48', 'PHC Truck', 2.3, 7890.78, 280.5, 220);
INSERT INTO public.equipment (id, truck_number, equipment_name, fuel_gph, annual_maint, annual_lic, days_used_per_year) VALUES (gen_random_uuid(), '60', 'Roll Off', 3.5, 18132.53, 414.5, 220);
INSERT INTO public.equipment (id, truck_number, equipment_name, fuel_gph, annual_maint, annual_lic, days_used_per_year) VALUES (gen_random_uuid(), '62', '60'' Bucket', 3.5, 10509.28, 384.2, 220);
INSERT INTO public.equipment (id, truck_number, equipment_name, fuel_gph, annual_maint, annual_lic, days_used_per_year) VALUES (gen_random_uuid(), '64', '75'' Bucket', 4.0, 17414.88, 511.0, 220);
INSERT INTO public.equipment (id, truck_number, equipment_name, fuel_gph, annual_maint, annual_lic, days_used_per_year) VALUES (gen_random_uuid(), '65', '75'' Bucket', 4.0, 8814.05, 599.1, 220);
INSERT INTO public.equipment (id, truck_number, equipment_name, fuel_gph, annual_maint, annual_lic, days_used_per_year) VALUES (gen_random_uuid(), '68', 'Grapple', 3.5, 12498.88, 599.1, 220);
INSERT INTO public.equipment (id, truck_number, equipment_name, fuel_gph, annual_maint, annual_lic, days_used_per_year) VALUES (gen_random_uuid(), '83', 'Chip Dump', 2.8, 10000.0, 409.5, 220);
INSERT INTO public.equipment (id, truck_number, equipment_name, fuel_gph, annual_maint, annual_lic, days_used_per_year) VALUES (gen_random_uuid(), '84', '56'' Bucket', 3.5, 7300.62, 325.25, 220);
INSERT INTO public.equipment (id, truck_number, equipment_name, fuel_gph, annual_maint, annual_lic, days_used_per_year) VALUES (gen_random_uuid(), '85', '56'' Bucket', 3.5, 513.4, 599.1, 220);
INSERT INTO public.equipment (id, truck_number, equipment_name, fuel_gph, annual_maint, annual_lic, days_used_per_year) VALUES (gen_random_uuid(), '87', 'Chip Dump', 2.8, 2055.01, 384.2, 220);
INSERT INTO public.equipment (id, truck_number, equipment_name, fuel_gph, annual_maint, annual_lic, days_used_per_year) VALUES (gen_random_uuid(), '88', '56'' Bucket', 3.5, 4527.52, 384.2, 220);
INSERT INTO public.equipment (id, truck_number, equipment_name, fuel_gph, annual_maint, annual_lic, days_used_per_year) VALUES (gen_random_uuid(), '90', 'Chip Dump', 2.8, 8099.9, 273.25, 220);
INSERT INTO public.equipment (id, truck_number, equipment_name, fuel_gph, annual_maint, annual_lic, days_used_per_year) VALUES (gen_random_uuid(), '91', 'PHC Truck', 2.3, 9413.57, 225.0, 220);
INSERT INTO public.equipment (id, truck_number, equipment_name, fuel_gph, annual_maint, annual_lic, days_used_per_year) VALUES (gen_random_uuid(), '92', 'PHC Truck', 2.3, 9000.0, 247.0, 220);
INSERT INTO public.equipment (id, truck_number, equipment_name, fuel_gph, annual_maint, annual_lic, days_used_per_year) VALUES (gen_random_uuid(), '93', 'PHC Truck', 2.3, 9000.0, 322.5, 220);
INSERT INTO public.equipment (id, truck_number, equipment_name, fuel_gph, annual_maint, annual_lic, days_used_per_year) VALUES (gen_random_uuid(), '94', 'Sprinter Van', 1.0, 2738.49, 116.5, 220);
INSERT INTO public.equipment (id, truck_number, equipment_name, fuel_gph, annual_maint, annual_lic, days_used_per_year) VALUES (gen_random_uuid(), '95', 'Lawn Truck', 1.8, 5180.46, 164.2, 220);
INSERT INTO public.equipment (id, truck_number, equipment_name, fuel_gph, annual_maint, annual_lic, days_used_per_year) VALUES (gen_random_uuid(), '96', '60'' Bucket', 3.5, 12362.48, 273.25, 220);
INSERT INTO public.equipment (id, truck_number, equipment_name, fuel_gph, annual_maint, annual_lic, days_used_per_year) VALUES (gen_random_uuid(), '97', '75'' Bucket', 4.0, 22679.98, 325.25, 220);
INSERT INTO public.equipment (id, truck_number, equipment_name, fuel_gph, annual_maint, annual_lic, days_used_per_year) VALUES (gen_random_uuid(), '98', '60'' Bucket', 3.5, 8393.57, 409.5, 220);
INSERT INTO public.equipment (id, truck_number, equipment_name, fuel_gph, annual_maint, annual_lic, days_used_per_year) VALUES (gen_random_uuid(), '99', 'Grapple', 3.5, 13962.44, 325.25, 220);
INSERT INTO public.equipment (id, truck_number, equipment_name, fuel_gph, annual_maint, annual_lic, days_used_per_year) VALUES (gen_random_uuid(), '100', '56'' Bucket', 3.5, 13367.3, 273.25, 220);
INSERT INTO public.equipment (id, truck_number, equipment_name, fuel_gph, annual_maint, annual_lic, days_used_per_year) VALUES (gen_random_uuid(), '101', '56'' Bucket', 3.5, 21025.89, 273.25, 220);
INSERT INTO public.equipment (id, truck_number, equipment_name, fuel_gph, annual_maint, annual_lic, days_used_per_year) VALUES (gen_random_uuid(), '102', '60'' Bucket', 3.5, 7212.4, 273.25, 220);
INSERT INTO public.equipment (id, truck_number, equipment_name, fuel_gph, annual_maint, annual_lic, days_used_per_year) VALUES (gen_random_uuid(), '103', 'Chip Dump', 2.8, 4732.72, 273.25, 220);
INSERT INTO public.equipment (id, truck_number, equipment_name, fuel_gph, annual_maint, annual_lic, days_used_per_year) VALUES (gen_random_uuid(), '104', 'Chip Dump', 2.8, 8087.12, 273.25, 220);
INSERT INTO public.equipment (id, truck_number, equipment_name, fuel_gph, annual_maint, annual_lic, days_used_per_year) VALUES (gen_random_uuid(), '105', 'Mason Dump', 2.5, 9001.81, 225.0, 220);
INSERT INTO public.equipment (id, truck_number, equipment_name, fuel_gph, annual_maint, annual_lic, days_used_per_year) VALUES (gen_random_uuid(), '106', 'PHC Truck', 2.3, 7445.96, 225.0, 220);
INSERT INTO public.equipment (id, truck_number, equipment_name, fuel_gph, annual_maint, annual_lic, days_used_per_year) VALUES (gen_random_uuid(), '107', 'Mason Dump', 2.5, 8087.77, 225.0, 220);
INSERT INTO public.equipment (id, truck_number, equipment_name, fuel_gph, annual_maint, annual_lic, days_used_per_year) VALUES (gen_random_uuid(), '108', 'Chip Dump', 2.8, 5958.63, 273.25, 220);
INSERT INTO public.equipment (id, truck_number, equipment_name, fuel_gph, annual_maint, annual_lic, days_used_per_year) VALUES (gen_random_uuid(), '109', 'Hook Lift', 3.0, 9000.0, 0, 220);
INSERT INTO public.equipment (id, truck_number, equipment_name, fuel_gph, annual_maint, annual_lic, days_used_per_year) VALUES (gen_random_uuid(), '109', 'Mini Rolloff Chip Dump', 2.8, 7706.11, 322.5, 220);
INSERT INTO public.equipment (id, truck_number, equipment_name, fuel_gph, annual_maint, annual_lic, days_used_per_year) VALUES (gen_random_uuid(), '109', 'Mini Rolloff Chipper Box', 2.5, 750.0, 0, 220);
INSERT INTO public.equipment (id, truck_number, equipment_name, fuel_gph, annual_maint, annual_lic, days_used_per_year) VALUES (gen_random_uuid(), '109', 'Mini Rolloff Container', 0, 500.0, 0, 220);
INSERT INTO public.equipment (id, truck_number, equipment_name, fuel_gph, annual_maint, annual_lic, days_used_per_year) VALUES (gen_random_uuid(), '110', 'Chip Dump', 2.8, 4769.8, 273.25, 220);
INSERT INTO public.equipment (id, truck_number, equipment_name, fuel_gph, annual_maint, annual_lic, days_used_per_year) VALUES (gen_random_uuid(), '111', '75'' Bucket', 4.0, 15833.03, 273.25, 220);
INSERT INTO public.equipment (id, truck_number, equipment_name, fuel_gph, annual_maint, annual_lic, days_used_per_year) VALUES (gen_random_uuid(), '112', '60'' Bucket', 3.5, 6075.77, 273.25, 220);
INSERT INTO public.equipment (id, truck_number, equipment_name, fuel_gph, annual_maint, annual_lic, days_used_per_year) VALUES (gen_random_uuid(), '113', '60'' Bucket', 3.5, 7431.79, 273.25, 220);
INSERT INTO public.equipment (id, truck_number, equipment_name, fuel_gph, annual_maint, annual_lic, days_used_per_year) VALUES (gen_random_uuid(), '114', 'Chip Dump', 2.8, 6428.71, 273.25, 220);
INSERT INTO public.equipment (id, truck_number, equipment_name, fuel_gph, annual_maint, annual_lic, days_used_per_year) VALUES (gen_random_uuid(), '115', 'Chip Dump', 2.8, 8538.01, 384.2, 220);
INSERT INTO public.equipment (id, truck_number, equipment_name, fuel_gph, annual_maint, annual_lic, days_used_per_year) VALUES (gen_random_uuid(), '116', 'Lawn Truck', 1.8, 3891.47, 247.0, 220);
INSERT INTO public.equipment (id, truck_number, equipment_name, fuel_gph, annual_maint, annual_lic, days_used_per_year) VALUES (gen_random_uuid(), '117', 'Mason Dump', 2.5, 4724.06, 247.0, 220);
INSERT INTO public.equipment (id, truck_number, equipment_name, fuel_gph, annual_maint, annual_lic, days_used_per_year) VALUES (gen_random_uuid(), '118', 'Mason Dump', 2.5, 7597.37, 225.0, 220);
INSERT INTO public.equipment (id, truck_number, equipment_name, fuel_gph, annual_maint, annual_lic, days_used_per_year) VALUES (gen_random_uuid(), '120', '75'' Bucket', 4.0, 20835.64, 599.1, 220);
INSERT INTO public.equipment (id, truck_number, equipment_name, fuel_gph, annual_maint, annual_lic, days_used_per_year) VALUES (gen_random_uuid(), '121', '60'' Bucket', 3.5, 12112.89, 325.25, 220);
INSERT INTO public.equipment (id, truck_number, equipment_name, fuel_gph, annual_maint, annual_lic, days_used_per_year) VALUES (gen_random_uuid(), '122', 'Chip Dump', 2.8, 5599.78, 273.25, 220);
INSERT INTO public.equipment (id, truck_number, equipment_name, fuel_gph, annual_maint, annual_lic, days_used_per_year) VALUES (gen_random_uuid(), '123', 'Chip Dump', 2.8, 7917.3, 409.5, 220);
INSERT INTO public.equipment (id, truck_number, equipment_name, fuel_gph, annual_maint, annual_lic, days_used_per_year) VALUES (gen_random_uuid(), '124', 'Lawn Truck', 1.8, 2747.1, 224.0, 220);
INSERT INTO public.equipment (id, truck_number, equipment_name, fuel_gph, annual_maint, annual_lic, days_used_per_year) VALUES (gen_random_uuid(), '125', 'Chip Dump', 2.8, 6310.04, 273.25, 220);
INSERT INTO public.equipment (id, truck_number, equipment_name, fuel_gph, annual_maint, annual_lic, days_used_per_year) VALUES (gen_random_uuid(), '126', 'Hook Lift', 3.0, 13772.98, 273.25, 220);
INSERT INTO public.equipment (id, truck_number, equipment_name, fuel_gph, annual_maint, annual_lic, days_used_per_year) VALUES (gen_random_uuid(), '127', 'Grapple', 3.5, 10525.69, 325.25, 220);
INSERT INTO public.equipment (id, truck_number, equipment_name, fuel_gph, annual_maint, annual_lic, days_used_per_year) VALUES (gen_random_uuid(), '128', 'Hook Lift', 3.0, 5450.38, 384.2, 220);
INSERT INTO public.equipment (id, truck_number, equipment_name, fuel_gph, annual_maint, annual_lic, days_used_per_year) VALUES (gen_random_uuid(), '129', 'Hook Lift', 3.0, 2695.98, 409.5, 220);
INSERT INTO public.equipment (id, truck_number, equipment_name, fuel_gph, annual_maint, annual_lic, days_used_per_year) VALUES (gen_random_uuid(), '130', 'Chip Dump', 2.8, 3554.6, 273.25, 220);
INSERT INTO public.equipment (id, truck_number, equipment_name, fuel_gph, annual_maint, annual_lic, days_used_per_year) VALUES (gen_random_uuid(), '131', 'Chip Dump', 2.8, 2287.15, 273.25, 220);
INSERT INTO public.equipment (id, truck_number, equipment_name, fuel_gph, annual_maint, annual_lic, days_used_per_year) VALUES (gen_random_uuid(), '132', 'Chip Dump', 2.8, 2868.24, 384.2, 220);
INSERT INTO public.equipment (id, truck_number, equipment_name, fuel_gph, annual_maint, annual_lic, days_used_per_year) VALUES (gen_random_uuid(), '133', 'Mason Dump', 2.5, 6434.25, 225.0, 220);
INSERT INTO public.equipment (id, truck_number, equipment_name, fuel_gph, annual_maint, annual_lic, days_used_per_year) VALUES (gen_random_uuid(), '134', 'Chip Dump', 2.8, 1709.34, 384.2, 220);
INSERT INTO public.equipment (id, truck_number, equipment_name, fuel_gph, annual_maint, annual_lic, days_used_per_year) VALUES (gen_random_uuid(), '135', 'Chip Dump', 2.8, 1733.52, 384.2, 220);
INSERT INTO public.equipment (id, truck_number, equipment_name, fuel_gph, annual_maint, annual_lic, days_used_per_year) VALUES (gen_random_uuid(), '136', 'Chip Dump', 2.8, 4724.56, 409.5, 220);
INSERT INTO public.equipment (id, truck_number, equipment_name, fuel_gph, annual_maint, annual_lic, days_used_per_year) VALUES (gen_random_uuid(), '137', 'PHC Truck', 2.3, 3974.52, 247.0, 220);
INSERT INTO public.equipment (id, truck_number, equipment_name, fuel_gph, annual_maint, annual_lic, days_used_per_year) VALUES (gen_random_uuid(), '138', 'Lawn Truck', 1.8, 2189.04, 225.0, 220);
INSERT INTO public.equipment (id, truck_number, equipment_name, fuel_gph, annual_maint, annual_lic, days_used_per_year) VALUES (gen_random_uuid(), '139', '60'' Bucket', 3.5, 7994.45, 373.75, 220);
INSERT INTO public.equipment (id, truck_number, equipment_name, fuel_gph, annual_maint, annual_lic, days_used_per_year) VALUES (gen_random_uuid(), '140', '60'' Bucket', 3.5, 2843.0, 325.25, 220);
INSERT INTO public.equipment (id, truck_number, equipment_name, fuel_gph, annual_maint, annual_lic, days_used_per_year) VALUES (gen_random_uuid(), '141', 'Chip Dump', 2.8, 323.53, 409.5, 220);
INSERT INTO public.equipment (id, truck_number, equipment_name, fuel_gph, annual_maint, annual_lic, days_used_per_year) VALUES (gen_random_uuid(), '142', 'Chip Dump', 2.8, 3586.39, 273.25, 220);
INSERT INTO public.equipment (id, truck_number, equipment_name, fuel_gph, annual_maint, annual_lic, days_used_per_year) VALUES (gen_random_uuid(), '143', 'Grapple', 3.5, 7334.64, 273.25, 220);
INSERT INTO public.equipment (id, truck_number, equipment_name, fuel_gph, annual_maint, annual_lic, days_used_per_year) VALUES (gen_random_uuid(), '144', 'Grapple', 3.5, 6806.97, 273.25, 220);
INSERT INTO public.equipment (id, truck_number, equipment_name, fuel_gph, annual_maint, annual_lic, days_used_per_year) VALUES (gen_random_uuid(), '145', 'Lawn Truck', 1.8, 1391.71, 189.0, 220);
INSERT INTO public.equipment (id, truck_number, equipment_name, fuel_gph, annual_maint, annual_lic, days_used_per_year) VALUES (gen_random_uuid(), '146', 'PHC Truck', 2.3, 2504.16, 225.0, 220);
INSERT INTO public.equipment (id, truck_number, equipment_name, fuel_gph, annual_maint, annual_lic, days_used_per_year) VALUES (gen_random_uuid(), '147', 'PHC Truck', 2.3, 5996.9, 322.5, 220);
INSERT INTO public.equipment (id, truck_number, equipment_name, fuel_gph, annual_maint, annual_lic, days_used_per_year) VALUES (gen_random_uuid(), '148', '75'' Bucket', 4.0, 1504.53, 280.75, 220);
INSERT INTO public.equipment (id, truck_number, equipment_name, fuel_gph, annual_maint, annual_lic, days_used_per_year) VALUES (gen_random_uuid(), '149', 'PHC Truck', 2.3, 936.87, 225.0, 220);
INSERT INTO public.equipment (id, truck_number, equipment_name, fuel_gph, annual_maint, annual_lic, days_used_per_year) VALUES (gen_random_uuid(), '150', 'PHC Truck', 2.3, 514.94, 225.0, 220);
INSERT INTO public.equipment (id, truck_number, equipment_name, fuel_gph, annual_maint, annual_lic, days_used_per_year) VALUES (gen_random_uuid(), '151', 'PHC Truck', 2.3, 538.45, 225.0, 220);
INSERT INTO public.equipment (id, truck_number, equipment_name, fuel_gph, annual_maint, annual_lic, days_used_per_year) VALUES (gen_random_uuid(), '152', 'PHC Truck', 2.3, 1049.15, 247.0, 220);
INSERT INTO public.equipment (id, truck_number, equipment_name, fuel_gph, annual_maint, annual_lic, days_used_per_year) VALUES (gen_random_uuid(), '153', 'PHC Truck', 2.3, 618.33, 322.5, 220);
INSERT INTO public.equipment (id, truck_number, equipment_name, fuel_gph, annual_maint, annual_lic, days_used_per_year) VALUES (gen_random_uuid(), '154', 'PHC Truck', 2.3, 1039.66, 425.0, 220);
INSERT INTO public.equipment (id, truck_number, equipment_name, fuel_gph, annual_maint, annual_lic, days_used_per_year) VALUES (gen_random_uuid(), '155', 'PHC Truck', 2.3, 174.15, 425.0, 220);
INSERT INTO public.equipment (id, truck_number, equipment_name, fuel_gph, annual_maint, annual_lic, days_used_per_year) VALUES (gen_random_uuid(), '156', 'Lawn Truck', 1.8, 279.95, 225.0, 220);
INSERT INTO public.equipment (id, truck_number, equipment_name, fuel_gph, annual_maint, annual_lic, days_used_per_year) VALUES (gen_random_uuid(), '157', 'Lawn Truck', 1.8, 335.69, 225.0, 220);
INSERT INTO public.equipment (id, truck_number, equipment_name, fuel_gph, annual_maint, annual_lic, days_used_per_year) VALUES (gen_random_uuid(), '158', 'Container', 0, 500.0, 0, 220);
INSERT INTO public.equipment (id, truck_number, equipment_name, fuel_gph, annual_maint, annual_lic, days_used_per_year) VALUES (gen_random_uuid(), '158', 'Switch & Go', 3.0, 477.7, 225.0, 220);
INSERT INTO public.equipment (id, truck_number, equipment_name, fuel_gph, annual_maint, annual_lic, days_used_per_year) VALUES (gen_random_uuid(), '159', 'Container', 0, 500.0, 0, 220);
INSERT INTO public.equipment (id, truck_number, equipment_name, fuel_gph, annual_maint, annual_lic, days_used_per_year) VALUES (gen_random_uuid(), '159', 'Switch & Go', 3.0, 882.04, 247.0, 220);
INSERT INTO public.equipment (id, truck_number, equipment_name, fuel_gph, annual_maint, annual_lic, days_used_per_year) VALUES (gen_random_uuid(), '160', '70'' Bucket w/Elevator', 4.0, 12000.0, 1100.0, 220);
INSERT INTO public.equipment (id, truck_number, equipment_name, fuel_gph, annual_maint, annual_lic, days_used_per_year) VALUES (gen_random_uuid(), '161', '70'' Bucket w/Elevator', 4.0, 12000.0, 1100.0, 220);
INSERT INTO public.equipment (id, truck_number, equipment_name, fuel_gph, annual_maint, annual_lic, days_used_per_year) VALUES (gen_random_uuid(), '206', '18" Chipper', 3.0, 7585.84, 0, 220);
INSERT INTO public.equipment (id, truck_number, equipment_name, fuel_gph, annual_maint, annual_lic, days_used_per_year) VALUES (gen_random_uuid(), '207', '18" Chipper', 3.0, 2665.48, 0, 220);
INSERT INTO public.equipment (id, truck_number, equipment_name, fuel_gph, annual_maint, annual_lic, days_used_per_year) VALUES (gen_random_uuid(), '209', '18" Chipper', 3.0, 4634.4, 10.0, 220);
INSERT INTO public.equipment (id, truck_number, equipment_name, fuel_gph, annual_maint, annual_lic, days_used_per_year) VALUES (gen_random_uuid(), '210', '18" Chipper', 3.0, 1222.71, 0, 220);
INSERT INTO public.equipment (id, truck_number, equipment_name, fuel_gph, annual_maint, annual_lic, days_used_per_year) VALUES (gen_random_uuid(), '211', '18" Chipper', 3.0, 745.34, 0, 220);
INSERT INTO public.equipment (id, truck_number, equipment_name, fuel_gph, annual_maint, annual_lic, days_used_per_year) VALUES (gen_random_uuid(), '212', '18" Chipper', 3.0, 806.52, 0, 220);
INSERT INTO public.equipment (id, truck_number, equipment_name, fuel_gph, annual_maint, annual_lic, days_used_per_year) VALUES (gen_random_uuid(), '213', '18" Chipper', 3.0, 1628.86, 0, 220);
INSERT INTO public.equipment (id, truck_number, equipment_name, fuel_gph, annual_maint, annual_lic, days_used_per_year) VALUES (gen_random_uuid(), '214', '18" Chipper', 3.0, 888.75, 0, 220);
INSERT INTO public.equipment (id, truck_number, equipment_name, fuel_gph, annual_maint, annual_lic, days_used_per_year) VALUES (gen_random_uuid(), '215', '18" Chipper', 3.0, 797.49, 0, 220);
INSERT INTO public.equipment (id, truck_number, equipment_name, fuel_gph, annual_maint, annual_lic, days_used_per_year) VALUES (gen_random_uuid(), '216', '18" Chipper', 3.0, 613.29, 0, 220);
INSERT INTO public.equipment (id, truck_number, equipment_name, fuel_gph, annual_maint, annual_lic, days_used_per_year) VALUES (gen_random_uuid(), '217', '18" Chipper', 3.0, 71.05, 0, 220);
INSERT INTO public.equipment (id, truck_number, equipment_name, fuel_gph, annual_maint, annual_lic, days_used_per_year) VALUES (gen_random_uuid(), '218', '18" Chipper', 3.0, 325.9, 27.0, 220);
INSERT INTO public.equipment (id, truck_number, equipment_name, fuel_gph, annual_maint, annual_lic, days_used_per_year) VALUES (gen_random_uuid(), '219', '18" Chipper', 3.0, 735.01, 0, 220);
INSERT INTO public.equipment (id, truck_number, equipment_name, fuel_gph, annual_maint, annual_lic, days_used_per_year) VALUES (gen_random_uuid(), '221', 'Trailer', 0, 1000.0, 0, 220);
INSERT INTO public.equipment (id, truck_number, equipment_name, fuel_gph, annual_maint, annual_lic, days_used_per_year) VALUES (gen_random_uuid(), '222', 'Trailer', 0, 1000.0, 0, 220);
INSERT INTO public.equipment (id, truck_number, equipment_name, fuel_gph, annual_maint, annual_lic, days_used_per_year) VALUES (gen_random_uuid(), '226', 'Trailer', 0, 1000.0, 0, 220);
INSERT INTO public.equipment (id, truck_number, equipment_name, fuel_gph, annual_maint, annual_lic, days_used_per_year) VALUES (gen_random_uuid(), '227', 'Trailer', 0, 500.64, 107.75, 220);
INSERT INTO public.equipment (id, truck_number, equipment_name, fuel_gph, annual_maint, annual_lic, days_used_per_year) VALUES (gen_random_uuid(), '228', 'Trailer', 0, 573.87, 91.5, 220);
INSERT INTO public.equipment (id, truck_number, equipment_name, fuel_gph, annual_maint, annual_lic, days_used_per_year) VALUES (gen_random_uuid(), '229', 'Trailer', 0, 1000.0, 0, 220);
INSERT INTO public.equipment (id, truck_number, equipment_name, fuel_gph, annual_maint, annual_lic, days_used_per_year) VALUES (gen_random_uuid(), '230', 'Trailer', 0, 225.33, 126.0, 220);
INSERT INTO public.equipment (id, truck_number, equipment_name, fuel_gph, annual_maint, annual_lic, days_used_per_year) VALUES (gen_random_uuid(), '231', 'Trailer', 0, 1185.0, 48.75, 220);
INSERT INTO public.equipment (id, truck_number, equipment_name, fuel_gph, annual_maint, annual_lic, days_used_per_year) VALUES (gen_random_uuid(), '232', 'Trailer', 0, 161.33, 91.5, 220);
INSERT INTO public.equipment (id, truck_number, equipment_name, fuel_gph, annual_maint, annual_lic, days_used_per_year) VALUES (gen_random_uuid(), '233', 'Trailer', 0, 7529.3, 85.5, 220);
INSERT INTO public.equipment (id, truck_number, equipment_name, fuel_gph, annual_maint, annual_lic, days_used_per_year) VALUES (gen_random_uuid(), '234', 'Trailer', 0, 9.67, 75.5, 220);
INSERT INTO public.equipment (id, truck_number, equipment_name, fuel_gph, annual_maint, annual_lic, days_used_per_year) VALUES (gen_random_uuid(), '235', 'Trailer', 0, 459.55, 75.5, 220);
INSERT INTO public.equipment (id, truck_number, equipment_name, fuel_gph, annual_maint, annual_lic, days_used_per_year) VALUES (gen_random_uuid(), '239', 'Wheel Loader', 3.5, 28598.74, 0, 220);
INSERT INTO public.equipment (id, truck_number, equipment_name, fuel_gph, annual_maint, annual_lic, days_used_per_year) VALUES (gen_random_uuid(), '243', 'Trailer', 0, 478.93, 126.0, 220);
INSERT INTO public.equipment (id, truck_number, equipment_name, fuel_gph, annual_maint, annual_lic, days_used_per_year) VALUES (gen_random_uuid(), '250', '20" Chipper', 3.0, 4526.43, 0, 220);
INSERT INTO public.equipment (id, truck_number, equipment_name, fuel_gph, annual_maint, annual_lic, days_used_per_year) VALUES (gen_random_uuid(), '255', 'Rotochopper - 255B 2015', 7.0, 32766.55, 0, 220);
INSERT INTO public.equipment (id, truck_number, equipment_name, fuel_gph, annual_maint, annual_lic, days_used_per_year) VALUES (gen_random_uuid(), '261', '15" Chipper', 2.3, 277.77, 0, 220);
INSERT INTO public.equipment (id, truck_number, equipment_name, fuel_gph, annual_maint, annual_lic, days_used_per_year) VALUES (gen_random_uuid(), '263', '18" Chipper', 3.0, 2538.58, 0, 220);
INSERT INTO public.equipment (id, truck_number, equipment_name, fuel_gph, annual_maint, annual_lic, days_used_per_year) VALUES (gen_random_uuid(), '263', 'Trailer', 0, 1000.0, 0, 220);
INSERT INTO public.equipment (id, truck_number, equipment_name, fuel_gph, annual_maint, annual_lic, days_used_per_year) VALUES (gen_random_uuid(), '265', '15" Chipper', 2.3, 3187.25, 0, 220);
INSERT INTO public.equipment (id, truck_number, equipment_name, fuel_gph, annual_maint, annual_lic, days_used_per_year) VALUES (gen_random_uuid(), '268', 'Trailer', 0, 1000.0, 0, 220);
INSERT INTO public.equipment (id, truck_number, equipment_name, fuel_gph, annual_maint, annual_lic, days_used_per_year) VALUES (gen_random_uuid(), '271', 'Trailer', 0, 1000.0, 0, 220);
INSERT INTO public.equipment (id, truck_number, equipment_name, fuel_gph, annual_maint, annual_lic, days_used_per_year) VALUES (gen_random_uuid(), '272', 'PHC Trailer', 0, 1000.0, 75.5, 220);
INSERT INTO public.equipment (id, truck_number, equipment_name, fuel_gph, annual_maint, annual_lic, days_used_per_year) VALUES (gen_random_uuid(), '273', '15" Chipper', 2.3, 5024.06, 10.0, 220);
INSERT INTO public.equipment (id, truck_number, equipment_name, fuel_gph, annual_maint, annual_lic, days_used_per_year) VALUES (gen_random_uuid(), '276', 'Air-Spade Trailer', 0, 875.11, 107.75, 220);
INSERT INTO public.equipment (id, truck_number, equipment_name, fuel_gph, annual_maint, annual_lic, days_used_per_year) VALUES (gen_random_uuid(), '279', '12" Chipper', 1.8, 425.46, 0, 220);
INSERT INTO public.equipment (id, truck_number, equipment_name, fuel_gph, annual_maint, annual_lic, days_used_per_year) VALUES (gen_random_uuid(), '280', '18" Chipper', 3.0, 10967.57, 0, 220);
INSERT INTO public.equipment (id, truck_number, equipment_name, fuel_gph, annual_maint, annual_lic, days_used_per_year) VALUES (gen_random_uuid(), '282', '18" Chipper', 3.0, 7335.24, 0, 220);
INSERT INTO public.equipment (id, truck_number, equipment_name, fuel_gph, annual_maint, annual_lic, days_used_per_year) VALUES (gen_random_uuid(), '283', '15" Chipper', 2.3, 6871.81, 126.0, 220);
INSERT INTO public.equipment (id, truck_number, equipment_name, fuel_gph, annual_maint, annual_lic, days_used_per_year) VALUES (gen_random_uuid(), '284', '15" Chipper', 2.3, 1317.23, 0, 220);
INSERT INTO public.equipment (id, truck_number, equipment_name, fuel_gph, annual_maint, annual_lic, days_used_per_year) VALUES (gen_random_uuid(), '286', '15" Chipper', 2.3, 6749.19, 0, 220);
INSERT INTO public.equipment (id, truck_number, equipment_name, fuel_gph, annual_maint, annual_lic, days_used_per_year) VALUES (gen_random_uuid(), '288', '15" Chipper', 2.3, 2610.32, 0, 220);
INSERT INTO public.equipment (id, truck_number, equipment_name, fuel_gph, annual_maint, annual_lic, days_used_per_year) VALUES (gen_random_uuid(), '289', '15" Chipper', 2.3, 449.37, 0, 220);
INSERT INTO public.equipment (id, truck_number, equipment_name, fuel_gph, annual_maint, annual_lic, days_used_per_year) VALUES (gen_random_uuid(), '293', '18" Chipper', 3.0, 5016.14, 0, 220);
INSERT INTO public.equipment (id, truck_number, equipment_name, fuel_gph, annual_maint, annual_lic, days_used_per_year) VALUES (gen_random_uuid(), '295', '15" Chipper', 2.3, 2510.6, 126.0, 220);
INSERT INTO public.equipment (id, truck_number, equipment_name, fuel_gph, annual_maint, annual_lic, days_used_per_year) VALUES (gen_random_uuid(), '298', '15" Chipper', 2.3, 5006.99, 32.0, 220);
INSERT INTO public.equipment (id, truck_number, equipment_name, fuel_gph, annual_maint, annual_lic, days_used_per_year) VALUES (gen_random_uuid(), '300', 'Skid Steer', 2.3, 5000.0, 0, 220);
INSERT INTO public.equipment (id, truck_number, equipment_name, fuel_gph, annual_maint, annual_lic, days_used_per_year) VALUES (gen_random_uuid(), '301', 'Wheel Loader', 3.5, 11000.0, 0, 220);
INSERT INTO public.equipment (id, truck_number, equipment_name, fuel_gph, annual_maint, annual_lic, days_used_per_year) VALUES (gen_random_uuid(), '303', 'Skid Steer', 2.3, 486.2, 0, 220);
INSERT INTO public.equipment (id, truck_number, equipment_name, fuel_gph, annual_maint, annual_lic, days_used_per_year) VALUES (gen_random_uuid(), '305', 'Branch Manager', 2.0, 4000.0, 0, 220);
INSERT INTO public.equipment (id, truck_number, equipment_name, fuel_gph, annual_maint, annual_lic, days_used_per_year) VALUES (gen_random_uuid(), '306', 'Branch Manager', 2.0, 4000.0, 0, 220);
INSERT INTO public.equipment (id, truck_number, equipment_name, fuel_gph, annual_maint, annual_lic, days_used_per_year) VALUES (gen_random_uuid(), '307', 'Skid Steer', 2.3, 5000.0, 0, 220);
INSERT INTO public.equipment (id, truck_number, equipment_name, fuel_gph, annual_maint, annual_lic, days_used_per_year) VALUES (gen_random_uuid(), '308', 'Grinder', 7.0, 12000.0, 0, 220);
INSERT INTO public.equipment (id, truck_number, equipment_name, fuel_gph, annual_maint, annual_lic, days_used_per_year) VALUES (gen_random_uuid(), '311', 'Branch Manager', 2.0, 5134.72, 0, 220);
INSERT INTO public.equipment (id, truck_number, equipment_name, fuel_gph, annual_maint, annual_lic, days_used_per_year) VALUES (gen_random_uuid(), '312', 'Branch Manager', 2.0, 2717.74, 0, 220);
INSERT INTO public.equipment (id, truck_number, equipment_name, fuel_gph, annual_maint, annual_lic, days_used_per_year) VALUES (gen_random_uuid(), '313', 'Branch Manager', 2.0, 3500.0, 0, 220);
INSERT INTO public.equipment (id, truck_number, equipment_name, fuel_gph, annual_maint, annual_lic, days_used_per_year) VALUES (gen_random_uuid(), '314', 'Branch Manager', 2.0, 428.14, 0, 220);
INSERT INTO public.equipment (id, truck_number, equipment_name, fuel_gph, annual_maint, annual_lic, days_used_per_year) VALUES (gen_random_uuid(), '315', 'Compressor', 1.8, 2000.0, 0, 220);
INSERT INTO public.equipment (id, truck_number, equipment_name, fuel_gph, annual_maint, annual_lic, days_used_per_year) VALUES (gen_random_uuid(), '316', 'Branch Manager', 2.0, 3500.0, 100.0, 220);
INSERT INTO public.equipment (id, truck_number, equipment_name, fuel_gph, annual_maint, annual_lic, days_used_per_year) VALUES (gen_random_uuid(), '323', 'Pickup Truck', 1.3, 10863.99, 28.75, 220);
INSERT INTO public.equipment (id, truck_number, equipment_name, fuel_gph, annual_maint, annual_lic, days_used_per_year) VALUES (gen_random_uuid(), '324', 'Shop Service Truck', 1.5, 7500.05, 360.5, 220);
INSERT INTO public.equipment (id, truck_number, equipment_name, fuel_gph, annual_maint, annual_lic, days_used_per_year) VALUES (gen_random_uuid(), '325', 'Hook Lift', 3.0, 1271.34, 323.5, 220);
INSERT INTO public.equipment (id, truck_number, equipment_name, fuel_gph, annual_maint, annual_lic, days_used_per_year) VALUES (gen_random_uuid(), '327', 'Pickup Truck', 1.3, 2366.27, 142.6, 220);
INSERT INTO public.equipment (id, truck_number, equipment_name, fuel_gph, annual_maint, annual_lic, days_used_per_year) VALUES (gen_random_uuid(), '328', 'Pickup Truck', 1.3, 925.08, 254.0, 220);
INSERT INTO public.equipment (id, truck_number, equipment_name, fuel_gph, annual_maint, annual_lic, days_used_per_year) VALUES (gen_random_uuid(), '329', 'Switch & Go', 3.0, 784.13, 225.0, 220);
INSERT INTO public.equipment (id, truck_number, equipment_name, fuel_gph, annual_maint, annual_lic, days_used_per_year) VALUES (gen_random_uuid(), '333', 'Fork Lift', 0.8, 3000.0, 0, 220);
INSERT INTO public.equipment (id, truck_number, equipment_name, fuel_gph, annual_maint, annual_lic, days_used_per_year) VALUES (gen_random_uuid(), '400', 'Lawn Applicator', 0.6, 1500.0, 0, 220);
INSERT INTO public.equipment (id, truck_number, equipment_name, fuel_gph, annual_maint, annual_lic, days_used_per_year) VALUES (gen_random_uuid(), '401', 'Lawn Applicator', 0.6, 1500.0, 0, 220);
INSERT INTO public.equipment (id, truck_number, equipment_name, fuel_gph, annual_maint, annual_lic, days_used_per_year) VALUES (gen_random_uuid(), '402', 'Lawn Machine', 1.5, 2000.0, 0, 220);
INSERT INTO public.equipment (id, truck_number, equipment_name, fuel_gph, annual_maint, annual_lic, days_used_per_year) VALUES (gen_random_uuid(), '403', 'Lawn Aerator', 0.4, 750.0, 0, 220);
INSERT INTO public.equipment (id, truck_number, equipment_name, fuel_gph, annual_maint, annual_lic, days_used_per_year) VALUES (gen_random_uuid(), '404', 'Spreader', 1.5, 2000.0, 0, 220);
INSERT INTO public.equipment (id, truck_number, equipment_name, fuel_gph, annual_maint, annual_lic, days_used_per_year) VALUES (gen_random_uuid(), '408', 'Spreader', 1.5, 2000.0, 0, 220);
INSERT INTO public.equipment (id, truck_number, equipment_name, fuel_gph, annual_maint, annual_lic, days_used_per_year) VALUES (gen_random_uuid(), '409', 'Lawn Applicator', 0.6, 1500.0, 0, 220);
INSERT INTO public.equipment (id, truck_number, equipment_name, fuel_gph, annual_maint, annual_lic, days_used_per_year) VALUES (gen_random_uuid(), '416', 'Riding Applicator', 0.6, 1500.0, 0, 220);
INSERT INTO public.equipment (id, truck_number, equipment_name, fuel_gph, annual_maint, annual_lic, days_used_per_year) VALUES (gen_random_uuid(), '417', 'Riding Applicator', 0.6, 1500.0, 0, 220);
INSERT INTO public.equipment (id, truck_number, equipment_name, fuel_gph, annual_maint, annual_lic, days_used_per_year) VALUES (gen_random_uuid(), '418', 'Riding Applicator', 0.6, 1500.0, 0, 220);
INSERT INTO public.equipment (id, truck_number, equipment_name, fuel_gph, annual_maint, annual_lic, days_used_per_year) VALUES (gen_random_uuid(), '419', 'Lawn Applicator', 0.6, 135.59, 0, 220);
INSERT INTO public.equipment (id, truck_number, equipment_name, fuel_gph, annual_maint, annual_lic, days_used_per_year) VALUES (gen_random_uuid(), '420', 'Lawn Applicator', 0.6, 9573.97, 0, 220);
INSERT INTO public.equipment (id, truck_number, equipment_name, fuel_gph, annual_maint, annual_lic, days_used_per_year) VALUES (gen_random_uuid(), '421', 'Lawn Applicator', 0.6, 1500.0, 0, 220);
INSERT INTO public.equipment (id, truck_number, equipment_name, fuel_gph, annual_maint, annual_lic, days_used_per_year) VALUES (gen_random_uuid(), '422', 'Lawn Applicator', 0.6, 1500.0, 0, 220);
INSERT INTO public.equipment (id, truck_number, equipment_name, fuel_gph, annual_maint, annual_lic, days_used_per_year) VALUES (gen_random_uuid(), '423', 'Lawn Applicator', 0.6, 1500.0, 0, 220);
INSERT INTO public.equipment (id, truck_number, equipment_name, fuel_gph, annual_maint, annual_lic, days_used_per_year) VALUES (gen_random_uuid(), '425', 'Lawn Applicator', 0.6, 1500.0, 0, 220);
INSERT INTO public.equipment (id, truck_number, equipment_name, fuel_gph, annual_maint, annual_lic, days_used_per_year) VALUES (gen_random_uuid(), '426', 'Lawn Applicator', 0.6, 1500.0, 0, 220);
INSERT INTO public.equipment (id, truck_number, equipment_name, fuel_gph, annual_maint, annual_lic, days_used_per_year) VALUES (gen_random_uuid(), '429', 'Lawn Applicator', 0.6, 1500.0, 0, 220);
INSERT INTO public.equipment (id, truck_number, equipment_name, fuel_gph, annual_maint, annual_lic, days_used_per_year) VALUES (gen_random_uuid(), '430', 'Lawn Applicator', 0.6, 1500.0, 0, 220);
INSERT INTO public.equipment (id, truck_number, equipment_name, fuel_gph, annual_maint, annual_lic, days_used_per_year) VALUES (gen_random_uuid(), '500', 'Slow Grinder', 6.0, 10000.0, 0, 220);
INSERT INTO public.equipment (id, truck_number, equipment_name, fuel_gph, annual_maint, annual_lic, days_used_per_year) VALUES (gen_random_uuid(), '501', 'Roll Off', 3.5, 3313.99, 414.5, 220);
INSERT INTO public.equipment (id, truck_number, equipment_name, fuel_gph, annual_maint, annual_lic, days_used_per_year) VALUES (gen_random_uuid(), '502', 'Trommel SC', 2.5, 1894.37, 0, 220);
INSERT INTO public.equipment (id, truck_number, equipment_name, fuel_gph, annual_maint, annual_lic, days_used_per_year) VALUES (gen_random_uuid(), '503', 'Payloader', 3.5, 3174.85, 0, 220);
INSERT INTO public.equipment (id, truck_number, equipment_name, fuel_gph, annual_maint, annual_lic, days_used_per_year) VALUES (gen_random_uuid(), '602', 'Stump Grinder', 1.8, 6000.0, 0, 220);
INSERT INTO public.equipment (id, truck_number, equipment_name, fuel_gph, annual_maint, annual_lic, days_used_per_year) VALUES (gen_random_uuid(), '604', 'Stump Grinder', 1.8, 6000.0, 0, 220);
INSERT INTO public.equipment (id, truck_number, equipment_name, fuel_gph, annual_maint, annual_lic, days_used_per_year) VALUES (gen_random_uuid(), '604', 'Trailer', 0, 1000.0, 0, 220);
INSERT INTO public.equipment (id, truck_number, equipment_name, fuel_gph, annual_maint, annual_lic, days_used_per_year) VALUES (gen_random_uuid(), '605', 'Stump Grinder', 1.8, 2618.99, 0, 220);
INSERT INTO public.equipment (id, truck_number, equipment_name, fuel_gph, annual_maint, annual_lic, days_used_per_year) VALUES (gen_random_uuid(), '605', 'Trailer', 0, 417.07, 0, 220);
INSERT INTO public.equipment (id, truck_number, equipment_name, fuel_gph, annual_maint, annual_lic, days_used_per_year) VALUES (gen_random_uuid(), '606', 'Stump Grinder', 1.8, 3587.58, 0, 220);
INSERT INTO public.equipment (id, truck_number, equipment_name, fuel_gph, annual_maint, annual_lic, days_used_per_year) VALUES (gen_random_uuid(), '607', 'Stump Grinder', 1.8, 1929.23, 0, 220);
INSERT INTO public.equipment (id, truck_number, equipment_name, fuel_gph, annual_maint, annual_lic, days_used_per_year) VALUES (gen_random_uuid(), '607', 'Trailer', 0, 1180.29, 75.5, 220);
INSERT INTO public.equipment (id, truck_number, equipment_name, fuel_gph, annual_maint, annual_lic, days_used_per_year) VALUES (gen_random_uuid(), '608', 'Stump Grinder', 1.8, 1419.02, 0, 220);
INSERT INTO public.equipment (id, truck_number, equipment_name, fuel_gph, annual_maint, annual_lic, days_used_per_year) VALUES (gen_random_uuid(), '608', 'Trailer', 0, 1103.78, 85.5, 220);
INSERT INTO public.equipment (id, truck_number, equipment_name, fuel_gph, annual_maint, annual_lic, days_used_per_year) VALUES (gen_random_uuid(), '610', 'Stump Grinder', 1.8, 5587.52, 0, 220);
INSERT INTO public.equipment (id, truck_number, equipment_name, fuel_gph, annual_maint, annual_lic, days_used_per_year) VALUES (gen_random_uuid(), '611', 'Stump Grinder', 1.8, 2969.29, 0, 220);
INSERT INTO public.equipment (id, truck_number, equipment_name, fuel_gph, annual_maint, annual_lic, days_used_per_year) VALUES (gen_random_uuid(), '611', 'Trailer', 0, 222.69, 0, 220);
INSERT INTO public.equipment (id, truck_number, equipment_name, fuel_gph, annual_maint, annual_lic, days_used_per_year) VALUES (gen_random_uuid(), '612', 'Stump Grinder', 1.8, 4000.0, 0, 220);
INSERT INTO public.equipment (id, truck_number, equipment_name, fuel_gph, annual_maint, annual_lic, days_used_per_year) VALUES (gen_random_uuid(), '612', 'Trailer', 0, 1000.0, 0, 220);
INSERT INTO public.equipment (id, truck_number, equipment_name, fuel_gph, annual_maint, annual_lic, days_used_per_year) VALUES (gen_random_uuid(), '614', 'Stump Grinder', 1.8, 4000.0, 150.0, 220);
INSERT INTO public.equipment (id, truck_number, equipment_name, fuel_gph, annual_maint, annual_lic, days_used_per_year) VALUES (gen_random_uuid(), '615', 'Stump Grinder', 1.8, 4000.0, 150.0, 220);
INSERT INTO public.equipment (id, truck_number, equipment_name, fuel_gph, annual_maint, annual_lic, days_used_per_year) VALUES (gen_random_uuid(), '616', 'Stump Grinder', 1.8, 4000.0, 150.0, 220);
INSERT INTO public.equipment (id, truck_number, equipment_name, fuel_gph, annual_maint, annual_lic, days_used_per_year) VALUES (gen_random_uuid(), '700', '92'' Spider Lift', 1.5, 5014.95, 0, 220);
INSERT INTO public.equipment (id, truck_number, equipment_name, fuel_gph, annual_maint, annual_lic, days_used_per_year) VALUES (gen_random_uuid(), '701', '90'' Spider Lift', 1.5, 5000.0, 0, 220);
INSERT INTO public.equipment (id, truck_number, equipment_name, fuel_gph, annual_maint, annual_lic, days_used_per_year) VALUES (gen_random_uuid(), '701', 'Trailer', 0, 1000.0, 0, 220);
INSERT INTO public.equipment (id, truck_number, equipment_name, fuel_gph, annual_maint, annual_lic, days_used_per_year) VALUES (gen_random_uuid(), '702', '90'' Spider Lift', 1.5, 1392.21, 0, 220);
INSERT INTO public.equipment (id, truck_number, equipment_name, fuel_gph, annual_maint, annual_lic, days_used_per_year) VALUES (gen_random_uuid(), '702', 'Trailer', 0, 9.22, 0, 220);

-- Default labor selections (AVG for all)
INSERT INTO public.labor_selections (branch_id, classification_label, selection) VALUES ('2220f69b-f3c3-40aa-9d0b-236545d53ea4', 'Foreman', 'AVG');
INSERT INTO public.labor_selections (branch_id, classification_label, selection) VALUES ('2220f69b-f3c3-40aa-9d0b-236545d53ea4', 'Climber', 'AVG');
INSERT INTO public.labor_selections (branch_id, classification_label, selection) VALUES ('2220f69b-f3c3-40aa-9d0b-236545d53ea4', 'Groundman', 'AVG');
INSERT INTO public.labor_selections (branch_id, classification_label, selection) VALUES ('2220f69b-f3c3-40aa-9d0b-236545d53ea4', 'Other-1', 'AVG');
INSERT INTO public.labor_selections (branch_id, classification_label, selection) VALUES ('2220f69b-f3c3-40aa-9d0b-236545d53ea4', 'Other-2', 'AVG');
INSERT INTO public.labor_selections (branch_id, classification_label, selection) VALUES ('7c624a53-1c95-4119-bb5a-7b6cf46ee62a', 'Foreman', 'AVG');
INSERT INTO public.labor_selections (branch_id, classification_label, selection) VALUES ('7c624a53-1c95-4119-bb5a-7b6cf46ee62a', 'Climber', 'AVG');
INSERT INTO public.labor_selections (branch_id, classification_label, selection) VALUES ('7c624a53-1c95-4119-bb5a-7b6cf46ee62a', 'Groundman', 'AVG');
INSERT INTO public.labor_selections (branch_id, classification_label, selection) VALUES ('7c624a53-1c95-4119-bb5a-7b6cf46ee62a', 'Other-1', 'AVG');
INSERT INTO public.labor_selections (branch_id, classification_label, selection) VALUES ('7c624a53-1c95-4119-bb5a-7b6cf46ee62a', 'Other-2', 'AVG');
INSERT INTO public.labor_selections (branch_id, classification_label, selection) VALUES ('835ed1c2-4d43-422b-9da0-2bd51f04214b', 'Foreman', 'AVG');
INSERT INTO public.labor_selections (branch_id, classification_label, selection) VALUES ('835ed1c2-4d43-422b-9da0-2bd51f04214b', 'Climber', 'AVG');
INSERT INTO public.labor_selections (branch_id, classification_label, selection) VALUES ('835ed1c2-4d43-422b-9da0-2bd51f04214b', 'Groundman', 'AVG');
INSERT INTO public.labor_selections (branch_id, classification_label, selection) VALUES ('835ed1c2-4d43-422b-9da0-2bd51f04214b', 'Other-1', 'AVG');
INSERT INTO public.labor_selections (branch_id, classification_label, selection) VALUES ('835ed1c2-4d43-422b-9da0-2bd51f04214b', 'Other-2', 'AVG');
INSERT INTO public.labor_selections (branch_id, classification_label, selection) VALUES ('bfb6250e-8636-4ca3-b8fa-01a6e1edfd32', 'Foreman', 'AVG');
INSERT INTO public.labor_selections (branch_id, classification_label, selection) VALUES ('bfb6250e-8636-4ca3-b8fa-01a6e1edfd32', 'Climber', 'AVG');
INSERT INTO public.labor_selections (branch_id, classification_label, selection) VALUES ('bfb6250e-8636-4ca3-b8fa-01a6e1edfd32', 'Groundman', 'AVG');
INSERT INTO public.labor_selections (branch_id, classification_label, selection) VALUES ('bfb6250e-8636-4ca3-b8fa-01a6e1edfd32', 'Other-1', 'AVG');
INSERT INTO public.labor_selections (branch_id, classification_label, selection) VALUES ('bfb6250e-8636-4ca3-b8fa-01a6e1edfd32', 'Other-2', 'AVG');