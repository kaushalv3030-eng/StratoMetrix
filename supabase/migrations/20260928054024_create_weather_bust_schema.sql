/*
# Weather Forecast Bust Prediction Platform — Schema

## Overview
Creates the full data model for a meteorological forecast bust prediction platform.
Users authenticate as either Forecaster/Admin or Standard User. The system stores
weather model grid data, historical bust labels, AI bust probability scores,
feature attributions, and alert notifications.

## Tables
1. `profiles` — extends auth.users with role (forecaster/admin/user), display name, organization
2. `grid_points` — geographic grid coordinates with metadata (lat, lon, region, elevation)
3. `forecasts` — NWP model predictions per grid point per forecast horizon day (1-10), with parameters (temp, pressure, wind_u, wind_v, humidity, precipitation)
4. `bust_history` — ground truth comparison records: forecast vs actual, error magnitude, bust label (0/1)
5. `bust_predictions` — AI-generated bust probability scores per grid point per horizon day, with confidence and model version
6. `feature_attributions` — SHAP-style feature attribution explaining each bust prediction (per-feature contribution)
7. `alerts` — automated warning notifications dispatched to stakeholders
8. `model_metrics` — tracked ML evaluation metrics over time (ROC-AUC, Brier score, FAR)

## Security
- `profiles`: owner-scoped CRUD (authenticated users manage their own profile)
- All weather data tables: read access for all authenticated users; write for forecaster/admin roles only
- `alerts`: users read their own alerts; forecasters/admins can create alerts
- RLS enabled on every table
*/

-- ============================================================================
-- PROFILES TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  display_name text NOT NULL DEFAULT '',
  role text NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'forecaster', 'admin')),
  organization text DEFAULT '',
  mfa_enabled boolean NOT NULL DEFAULT false,
  biometric_enabled boolean NOT NULL DEFAULT false,
  avatar_color text NOT NULL DEFAULT '#0ea5e9',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_profile" ON profiles;
CREATE POLICY "select_own_profile" ON profiles FOR SELECT
  TO authenticated USING (auth.uid() = id);

DROP POLICY IF EXISTS "insert_own_profile" ON profiles;
CREATE POLICY "insert_own_profile" ON profiles FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "update_own_profile" ON profiles;
CREATE POLICY "update_own_profile" ON profiles FOR UPDATE
  TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- Allow users to see other users' display names and roles (for team awareness)
DROP POLICY IF EXISTS "select_all_profiles_limited" ON profiles;
CREATE POLICY "select_all_profiles_limited" ON profiles FOR SELECT
  TO authenticated USING (true);

-- ============================================================================
-- GRID POINTS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS grid_points (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  grid_id text UNIQUE NOT NULL,
  latitude double precision NOT NULL,
  longitude double precision NOT NULL,
  region text NOT NULL DEFAULT '',
  elevation_m double precision DEFAULT 0,
  station_code text DEFAULT '',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE grid_points ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "gp_select" ON grid_points;
CREATE POLICY "gp_select" ON grid_points FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "gp_insert" ON grid_points;
CREATE POLICY "gp_insert" ON grid_points FOR INSERT
  TO authenticated WITH CHECK (auth.uid() IN (SELECT id FROM profiles WHERE role IN ('forecaster', 'admin')));

DROP POLICY IF EXISTS "gp_update" ON grid_points;
CREATE POLICY "gp_update" ON grid_points FOR UPDATE
  TO authenticated USING (auth.uid() IN (SELECT id FROM profiles WHERE role IN ('forecaster', 'admin')));

DROP POLICY IF EXISTS "gp_delete" ON grid_points;
CREATE POLICY "gp_delete" ON grid_points FOR DELETE
  TO authenticated USING (auth.uid() IN (SELECT id FROM profiles WHERE role IN ('forecaster', 'admin')));

-- ============================================================================
-- FORECASTS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS forecasts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  grid_point_id uuid NOT NULL REFERENCES grid_points(id) ON DELETE CASCADE,
  forecast_date date NOT NULL,
  horizon_day integer NOT NULL CHECK (horizon_day BETWEEN 1 AND 10),
  model_source text NOT NULL DEFAULT 'GFS',
  temperature_2m double precision,
  surface_pressure double precision,
  wind_u_10m double precision,
  wind_v_10m double precision,
  humidity_2m double precision,
  precipitation_mm double precision,
  geopotential_500 double precision,
  wind_shear_850_200 double precision,
  created_at timestamptz DEFAULT now(),
  UNIQUE(grid_point_id, forecast_date, horizon_day, model_source)
);

ALTER TABLE forecasts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "fc_select" ON forecasts;
CREATE POLICY "fc_select" ON forecasts FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "fc_insert" ON forecasts;
CREATE POLICY "fc_insert" ON forecasts FOR INSERT
  TO authenticated WITH CHECK (auth.uid() IN (SELECT id FROM profiles WHERE role IN ('forecaster', 'admin')));

DROP POLICY IF EXISTS "fc_update" ON forecasts;
CREATE POLICY "fc_update" ON forecasts FOR UPDATE
  TO authenticated USING (auth.uid() IN (SELECT id FROM profiles WHERE role IN ('forecaster', 'admin')));

DROP POLICY IF EXISTS "fc_delete" ON forecasts;
CREATE POLICY "fc_delete" ON forecasts FOR DELETE
  TO authenticated USING (auth.uid() IN (SELECT id FROM profiles WHERE role IN ('forecaster', 'admin')));

CREATE INDEX IF NOT EXISTS idx_forecasts_grid_date_horizon ON forecasts(grid_point_id, forecast_date, horizon_day);

-- ============================================================================
-- BUST HISTORY TABLE (Ground Truth)
-- ============================================================================
CREATE TABLE IF NOT EXISTS bust_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  grid_point_id uuid NOT NULL REFERENCES grid_points(id) ON DELETE CASCADE,
  forecast_date date NOT NULL,
  horizon_day integer NOT NULL CHECK (horizon_day BETWEEN 1 AND 10),
  forecast_temp double precision,
  actual_temp double precision,
  temp_error double precision,
  forecast_pressure double precision,
  actual_pressure double precision,
  pressure_error double precision,
  forecast_wind_speed double precision,
  actual_wind_speed double precision,
  wind_error double precision,
  forecast_precip double precision,
  actual_precip double precision,
  precip_error double precision,
  is_bust integer NOT NULL DEFAULT 0 CHECK (is_bust IN (0, 1)),
  bust_severity text DEFAULT 'reliable' CHECK (bust_severity IN ('reliable', 'minor', 'moderate', 'severe', 'extreme')),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE bust_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "bh_select" ON bust_history;
CREATE POLICY "bh_select" ON bust_history FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "bh_insert" ON bust_history;
CREATE POLICY "bh_insert" ON bust_history FOR INSERT
  TO authenticated WITH CHECK (auth.uid() IN (SELECT id FROM profiles WHERE role IN ('forecaster', 'admin')));

DROP POLICY IF EXISTS "bh_update" ON bust_history;
CREATE POLICY "bh_update" ON bust_history FOR UPDATE
  TO authenticated USING (auth.uid() IN (SELECT id FROM profiles WHERE role IN ('forecaster', 'admin')));

DROP POLICY IF EXISTS "bh_delete" ON bust_history;
CREATE POLICY "bh_delete" ON bust_history FOR DELETE
  TO authenticated USING (auth.uid() IN (SELECT id FROM profiles WHERE role IN ('forecaster', 'admin')));

CREATE INDEX IF NOT EXISTS idx_bust_history_grid_date ON bust_history(grid_point_id, forecast_date);

-- ============================================================================
-- BUST PREDICTIONS TABLE (AI Inference)
-- ============================================================================
CREATE TABLE IF NOT EXISTS bust_predictions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  grid_point_id uuid NOT NULL REFERENCES grid_points(id) ON DELETE CASCADE,
  forecast_date date NOT NULL,
  horizon_day integer NOT NULL CHECK (horizon_day BETWEEN 1 AND 10),
  bust_probability double precision NOT NULL CHECK (bust_probability BETWEEN 0 AND 1),
  confidence_score double precision,
  risk_level text NOT NULL DEFAULT 'low' CHECK (risk_level IN ('low', 'moderate', 'high', 'critical')),
  model_version text NOT NULL DEFAULT 'xgb-v1.0',
  spatial_confidence double precision,
  created_at timestamptz DEFAULT now(),
  UNIQUE(grid_point_id, forecast_date, horizon_day, model_version)
);

ALTER TABLE bust_predictions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "bp_select" ON bust_predictions;
CREATE POLICY "bp_select" ON bust_predictions FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "bp_insert" ON bust_predictions;
CREATE POLICY "bp_insert" ON bust_predictions FOR INSERT
  TO authenticated WITH CHECK (auth.uid() IN (SELECT id FROM profiles WHERE role IN ('forecaster', 'admin')));

DROP POLICY IF EXISTS "bp_update" ON bust_predictions;
CREATE POLICY "bp_update" ON bust_predictions FOR UPDATE
  TO authenticated USING (auth.uid() IN (SELECT id FROM profiles WHERE role IN ('forecaster', 'admin')));

DROP POLICY IF EXISTS "bp_delete" ON bust_predictions;
CREATE POLICY "bp_delete" ON bust_predictions FOR DELETE
  TO authenticated USING (auth.uid() IN (SELECT id FROM profiles WHERE role IN ('forecaster', 'admin')));

CREATE INDEX IF NOT EXISTS idx_bp_grid_date_horizon ON bust_predictions(grid_point_id, forecast_date, horizon_day);

-- ============================================================================
-- FEATURE ATTRIBUTIONS TABLE (Explainability)
-- ============================================================================
CREATE TABLE IF NOT EXISTS feature_attributions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bust_prediction_id uuid NOT NULL REFERENCES bust_predictions(id) ON DELETE CASCADE,
  feature_name text NOT NULL,
  feature_value double precision,
  attribution_score double precision NOT NULL,
  direction text NOT NULL DEFAULT 'neutral' CHECK (direction IN ('positive', 'negative', 'neutral')),
  rank integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE feature_attributions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "fa_select" ON feature_attributions;
CREATE POLICY "fa_select" ON feature_attributions FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "fa_insert" ON feature_attributions;
CREATE POLICY "fa_insert" ON feature_attributions FOR INSERT
  TO authenticated WITH CHECK (auth.uid() IN (SELECT id FROM profiles WHERE role IN ('forecaster', 'admin')));

DROP POLICY IF EXISTS "fa_update" ON feature_attributions;
CREATE POLICY "fa_update" ON feature_attributions FOR UPDATE
  TO authenticated USING (auth.uid() IN (SELECT id FROM profiles WHERE role IN ('forecaster', 'admin')));

DROP POLICY IF EXISTS "fa_delete" ON feature_attributions;
CREATE POLICY "fa_delete" ON feature_attributions FOR DELETE
  TO authenticated USING (auth.uid() IN (SELECT id FROM profiles WHERE role IN ('forecaster', 'admin')));

CREATE INDEX IF NOT EXISTS idx_fa_prediction ON feature_attributions(bust_prediction_id);

-- ============================================================================
-- ALERTS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  grid_point_id uuid REFERENCES grid_points(id) ON DELETE CASCADE,
  bust_prediction_id uuid REFERENCES bust_predictions(id) ON DELETE SET NULL,
  title text NOT NULL,
  message text NOT NULL,
  risk_level text NOT NULL DEFAULT 'moderate' CHECK (risk_level IN ('low', 'moderate', 'high', 'critical')),
  delivery_channel text NOT NULL DEFAULT 'in_app' CHECK (delivery_channel IN ('in_app', 'sms', 'webhook', 'email')),
  is_read boolean NOT NULL DEFAULT false,
  is_dispatched boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE alerts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "al_select" ON alerts;
CREATE POLICY "al_select" ON alerts FOR SELECT
  TO authenticated USING (auth.uid() = user_id OR auth.uid() IN (SELECT id FROM profiles WHERE role IN ('forecaster', 'admin')));

DROP POLICY IF EXISTS "al_insert" ON alerts;
CREATE POLICY "al_insert" ON alerts FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id OR auth.uid() IN (SELECT id FROM profiles WHERE role IN ('forecaster', 'admin')));

DROP POLICY IF EXISTS "al_update" ON alerts;
CREATE POLICY "al_update" ON alerts FOR UPDATE
  TO authenticated USING (auth.uid() = user_id OR auth.uid() IN (SELECT id FROM profiles WHERE role IN ('forecaster', 'admin')));

DROP POLICY IF EXISTS "al_delete" ON alerts;
CREATE POLICY "al_delete" ON alerts FOR DELETE
  TO authenticated USING (auth.uid() = user_id OR auth.uid() IN (SELECT id FROM profiles WHERE role IN ('forecaster', 'admin')));

CREATE INDEX IF NOT EXISTS idx_alerts_user_read ON alerts(user_id, is_read);

-- ============================================================================
-- MODEL METRICS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS model_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  metric_date date NOT NULL,
  model_version text NOT NULL DEFAULT 'xgb-v1.0',
  roc_auc double precision NOT NULL,
  brier_score double precision NOT NULL,
  false_alarm_rate double precision NOT NULL,
  hit_rate double precision NOT NULL,
  precision_score double precision NOT NULL,
  recall_score double precision NOT NULL,
  training_samples integer NOT NULL DEFAULT 0,
  notes text DEFAULT '',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE model_metrics ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "mm_select" ON model_metrics;
CREATE POLICY "mm_select" ON model_metrics FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "mm_insert" ON model_metrics;
CREATE POLICY "mm_insert" ON model_metrics FOR INSERT
  TO authenticated WITH CHECK (auth.uid() IN (SELECT id FROM profiles WHERE role IN ('forecaster', 'admin')));

DROP POLICY IF EXISTS "mm_update" ON model_metrics;
CREATE POLICY "mm_update" ON model_metrics FOR UPDATE
  TO authenticated USING (auth.uid() IN (SELECT id FROM profiles WHERE role IN ('forecaster', 'admin')));

DROP POLICY IF EXISTS "mm_delete" ON model_metrics;
CREATE POLICY "mm_delete" ON model_metrics FOR DELETE
  TO authenticated USING (auth.uid() IN (SELECT id FROM profiles WHERE role IN ('forecaster', 'admin')));

-- ============================================================================
-- AUTO-CREATE PROFILE ON SIGNUP
-- ============================================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, display_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'role', 'user')
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
