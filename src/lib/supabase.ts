import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
});

export type UserRole = 'user' | 'forecaster' | 'admin';

export interface Profile {
  id: string;
  email: string;
  display_name: string;
  role: UserRole;
  organization: string;
  mfa_enabled: boolean;
  biometric_enabled: boolean;
  avatar_color: string;
  created_at: string;
  updated_at: string;
}

export interface GridPoint {
  id: string;
  grid_id: string;
  latitude: number;
  longitude: number;
  region: string;
  elevation_m: number;
  station_code: string;
  created_at: string;
}

export interface Forecast {
  id: string;
  grid_point_id: string;
  forecast_date: string;
  horizon_day: number;
  model_source: string;
  temperature_2m: number;
  surface_pressure: number;
  wind_u_10m: number;
  wind_v_10m: number;
  humidity_2m: number;
  precipitation_mm: number;
  geopotential_500: number;
  wind_shear_850_200: number;
  created_at: string;
}

export interface BustHistory {
  id: string;
  grid_point_id: string;
  forecast_date: string;
  horizon_day: number;
  forecast_temp: number;
  actual_temp: number;
  temp_error: number;
  forecast_pressure: number;
  actual_pressure: number;
  pressure_error: number;
  forecast_wind_speed: number;
  actual_wind_speed: number;
  wind_error: number;
  forecast_precip: number;
  actual_precip: number;
  precip_error: number;
  is_bust: number;
  bust_severity: string;
  created_at: string;
}

export interface BustPrediction {
  id: string;
  grid_point_id: string;
  forecast_date: string;
  horizon_day: number;
  bust_probability: number;
  confidence_score: number;
  risk_level: 'low' | 'moderate' | 'high' | 'critical';
  model_version: string;
  spatial_confidence: number;
  created_at: string;
}

export interface FeatureAttribution {
  id: string;
  bust_prediction_id: string;
  feature_name: string;
  feature_value: number;
  attribution_score: number;
  direction: 'positive' | 'negative' | 'neutral';
  rank: number;
  created_at: string;
}

export interface Alert {
  id: string;
  user_id: string | null;
  grid_point_id: string | null;
  bust_prediction_id: string | null;
  title: string;
  message: string;
  risk_level: 'low' | 'moderate' | 'high' | 'critical';
  delivery_channel: 'in_app' | 'sms' | 'webhook' | 'email';
  is_read: boolean;
  is_dispatched: boolean;
  created_at: string;
}

export interface ModelMetric {
  id: string;
  metric_date: string;
  model_version: string;
  roc_auc: number;
  brier_score: number;
  false_alarm_rate: number;
  hit_rate: number;
  precision_score: number;
  recall_score: number;
  training_samples: number;
  notes: string;
  created_at: string;
}

export const FEATURE_LABELS: Record<string, string> = {
  temperature_2m: 'Temperature (2m)',
  surface_pressure: 'Surface Pressure',
  wind_shear_850_200: 'Wind Shear (850–200 hPa)',
  humidity_2m: 'Humidity (2m)',
  precipitation_mm: 'Precipitation',
  geopotential_500: 'Geopotential Height (500 hPa)',
  wind_speed_10m: 'Wind Speed (10m)',
  horizon_day: 'Forecast Horizon (days)',
};

export const FEATURE_UNITS: Record<string, string> = {
  temperature_2m: '°C',
  surface_pressure: 'hPa',
  wind_shear_850_200: 'm/s',
  humidity_2m: '%',
  precipitation_mm: 'mm',
  geopotential_500: 'm',
  wind_speed_10m: 'm/s',
  horizon_day: 'd',
};
