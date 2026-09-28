import { useMemo, useState } from 'react';
import {
  X,
  Thermometer,
  Gauge,
  Wind,
  Droplets,
  CloudRain,
  Layers,
  Zap,
  TrendingUp,
  TrendingDown,
  Minus,
} from 'lucide-react';
import type {
  GridPoint,
  BustPrediction,
  FeatureAttribution,
  Forecast,
  BustHistory,
} from '@/lib/supabase';
import { FEATURE_LABELS, FEATURE_UNITS } from '@/lib/supabase';
import { probColor, riskColor } from './WorldMap';

interface GridDetailPanelProps {
  gridPoint: GridPoint;
  predictions: BustPrediction[];
  forecasts: Forecast[];
  attributions: FeatureAttribution[];
  bustHistory: BustHistory[];
  onClose: () => void;
  onCreateAlert: (pred: BustPrediction) => void;
}

const FEATURE_ICONS: Record<string, typeof Thermometer> = {
  temperature_2m: Thermometer,
  surface_pressure: Gauge,
  wind_shear_850_200: Zap,
  humidity_2m: Droplets,
  precipitation_mm: CloudRain,
  geopotential_500: Layers,
  wind_speed_10m: Wind,
  horizon_day: TrendingUp,
};

export function GridDetailPanel({
  gridPoint,
  predictions,
  forecasts,
  attributions,
  bustHistory,
  onClose,
  onCreateAlert,
}: GridDetailPanelProps) {
  const [selectedHorizon, setSelectedHorizon] = useState(1);

  const currentPred = predictions.find((p) => p.horizon_day === selectedHorizon);
  const currentForecast = forecasts.find((f) => f.horizon_day === selectedHorizon);
  const currentAttributions = useMemo(() => {
    if (!currentPred) return [];
    return attributions
      .filter((a) => a.bust_prediction_id === currentPred.id)
      .sort((a, b) => Math.abs(b.attribution_score) - Math.abs(a.attribution_score));
  }, [currentPred, attributions]);

  const gridHistory = useMemo(
    () => bustHistory.filter((h) => h.grid_point_id === gridPoint.id),
    [bustHistory, gridPoint.id],
  );

  const bustRateByDay = useMemo(() => {
    const result: { day: number; rate: number; count: number }[] = [];
    for (let d = 1; d <= 10; d++) {
      const dayRecords = gridHistory.filter((h) => h.horizon_day === d);
      const busts = dayRecords.filter((h) => h.is_bust === 1).length;
      const rate = dayRecords.length > 0 ? busts / dayRecords.length : 0;
      result.push({ day: d, rate, count: dayRecords.length });
    }
    return result;
  }, [gridHistory]);

  const maxAttrScore = Math.max(...currentAttributions.map((a) => Math.abs(a.attribution_score)), 0.001);

  return (
    <div className="h-full flex flex-col animate-slide-in-right">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-storm-700/20">
        <div>
          <h2 className="text-lg font-bold text-white">{gridPoint.region}</h2>
          <div className="flex items-center gap-3 text-xs text-storm-500 mt-0.5">
            <span className="font-mono">{gridPoint.grid_id}</span>
            <span>{gridPoint.latitude.toFixed(4)}°, {gridPoint.longitude.toFixed(4)}°</span>
            {gridPoint.elevation_m > 0 && <span>{gridPoint.elevation_m}m elev</span>}
            {gridPoint.station_code && <span className="text-ocean-400">{gridPoint.station_code}</span>}
          </div>
        </div>
        <button onClick={onClose} className="btn-ghost p-2 rounded-lg">
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-5">
        {/* Horizon selector */}
        <div>
          <div className="text-xs text-storm-400 font-medium uppercase tracking-wider mb-2">Forecast Horizon (1–10 days)</div>
          <div className="grid grid-cols-10 gap-1">
            {Array.from({ length: 10 }, (_, i) => i + 1).map((day) => {
              const pred = predictions.find((p) => p.horizon_day === day);
              const prob = pred?.bust_probability ?? 0;
              const active = selectedHorizon === day;
              return (
                <button
                  key={day}
                  onClick={() => setSelectedHorizon(day)}
                  className={`flex flex-col items-center py-2 rounded-lg border transition-all ${
                    active ? 'border-ocean-500 bg-ocean-500/10' : 'border-storm-700/20 hover:border-storm-600/40'
                  }`}
                  style={active ? {} : {}}
                >
                  <span className={`text-xs font-medium ${active ? 'text-ocean-300' : 'text-storm-400'}`}>D{day}</span>
                  <div
                    className="w-1.5 h-1.5 rounded-full mt-1"
                    style={{ background: probColor(prob) }}
                  />
                  <span className="text-[10px] font-mono text-storm-500 mt-0.5">{(prob * 100).toFixed(0)}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Bust probability gauge */}
        {currentPred && (
          <div className="stat-card rounded-2xl p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium text-storm-300">Bust Probability — Day {selectedHorizon}</span>
              <span
                className="risk-badge"
                style={{
                  background: `${riskColor(currentPred.risk_level)}20`,
                  color: riskColor(currentPred.risk_level),
                  border: `1px solid ${riskColor(currentPred.risk_level)}40`,
                }}
              >
                {currentPred.risk_level}
              </span>
            </div>
            <div className="flex items-end gap-4">
              <div className="text-4xl font-bold font-mono" style={{ color: probColor(currentPred.bust_probability) }}>
                {(currentPred.bust_probability * 100).toFixed(1)}%
              </div>
              <div className="flex-1 pb-1">
                <div className="h-2 rounded-full bg-storm-900/60 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{
                      width: `${currentPred.bust_probability * 100}%`,
                      background: `linear-gradient(90deg, ${probColor(currentPred.bust_probability)} 0%, ${probColor(currentPred.bust_probability)}cc 100%)`,
                    }}
                  />
                </div>
                <div className="flex items-center justify-between mt-2 text-xs text-storm-500">
                  <span>Confidence: <span className="text-storm-300 font-mono">{(currentPred.confidence_score * 100).toFixed(0)}%</span></span>
                  <span>Spatial: <span className="text-storm-300 font-mono">{(currentPred.spatial_confidence * 100).toFixed(0)}%</span></span>
                </div>
              </div>
            </div>
            <button
              onClick={() => onCreateAlert(currentPred)}
              className="w-full mt-3 py-2 rounded-xl text-sm font-medium border border-orange-500/30 bg-orange-500/10 text-orange-400 hover:bg-orange-500/20 transition-all"
            >
              Dispatch Risk Alert
            </button>
          </div>
        )}

        {/* NWP forecast parameters */}
        {currentForecast && (
          <div>
            <div className="text-xs text-storm-400 font-medium uppercase tracking-wider mb-2">NWP Parameters — Day {selectedHorizon}</div>
            <div className="grid grid-cols-2 gap-2">
              <ForecastCard icon={Thermometer} label="Temperature" value={currentForecast.temperature_2m} unit="°C" color="#f97316" />
              <ForecastCard icon={Gauge} label="Pressure" value={currentForecast.surface_pressure} unit="hPa" color="#0ea5e9" />
              <ForecastCard icon={Wind} label="Wind Speed" value={Math.sqrt(currentForecast.wind_u_10m ** 2 + currentForecast.wind_v_10m ** 2)} unit="m/s" color="#38bdf8" />
              <ForecastCard icon={Droplets} label="Humidity" value={currentForecast.humidity_2m} unit="%" color="#22d3ee" />
              <ForecastCard icon={CloudRain} label="Precipitation" value={currentForecast.precipitation_mm} unit="mm" color="#06b6d4" />
              <ForecastCard icon={Layers} label="Geopotential 500" value={currentForecast.geopotential_500} unit="m" color="#688fb5" />
              <ForecastCard icon={Zap} label="Wind Shear" value={currentForecast.wind_shear_850_200} unit="m/s" color="#eab308" />
              <ForecastCard icon={TrendingUp} label="Model Source" value={currentForecast.model_source} unit="" color="#48709a" isText />
            </div>
          </div>
        )}

        {/* Feature attribution / explainability */}
        {currentAttributions.length > 0 && (
          <div>
            <div className="text-xs text-storm-400 font-medium uppercase tracking-wider mb-2">
              Feature Attribution — Explainability (SHAP-style)
            </div>
            <div className="stat-card rounded-2xl p-4 space-y-2.5">
              {currentAttributions.map((attr) => {
                const Icon = FEATURE_ICONS[attr.feature_name] || Minus;
                const width = (Math.abs(attr.attribution_score) / maxAttrScore) * 100;
                const isPositive = attr.direction === 'positive';
                const isNegative = attr.direction === 'negative';
                return (
                  <div key={attr.id} className="flex items-center gap-3">
                    <div className="flex items-center gap-2 w-40 flex-shrink-0">
                      <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${
                        isPositive ? 'bg-red-500/15' : isNegative ? 'bg-green-500/15' : 'bg-storm-800/50'
                      }`}>
                        <Icon className={`w-3.5 h-3.5 ${isPositive ? 'text-red-400' : isNegative ? 'text-green-400' : 'text-storm-500'}`} />
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs font-medium text-storm-200 truncate">
                          {FEATURE_LABELS[attr.feature_name] || attr.feature_name}
                        </div>
                        <div className="text-xs text-storm-500 font-mono">
                          {attr.feature_value}{FEATURE_UNITS[attr.feature_name] ? ` ${FEATURE_UNITS[attr.feature_name]}` : ''}
                        </div>
                      </div>
                    </div>
                    <div className="flex-1 relative h-6 flex items-center">
                      <div className="absolute left-1/2 top-0 bottom-0 w-px bg-storm-700/30" />
                      <div
                        className={`absolute h-3 rounded-sm transition-all duration-500 ${
                          isPositive ? 'bg-red-500/60' : 'bg-green-500/60'
                        }`}
                        style={{
                          width: `${width / 2}%`,
                          left: isPositive ? '50%' : `${50 - width / 2}%`,
                        }}
                      />
                      <span className={`absolute text-xs font-mono ${isPositive ? 'text-red-400' : 'text-green-400'}`}
                        style={{ left: isPositive ? `calc(50% + ${width / 2}% + 4px)` : `calc(${50 - width / 2}% - 50px)` }}>
                        {attr.attribution_score > 0 ? '+' : ''}{attr.attribution_score.toFixed(4)}
                      </span>
                    </div>
                  </div>
                );
              })}
              <div className="flex items-center justify-between pt-2 border-t border-storm-700/20 text-xs text-storm-500">
                <span className="flex items-center gap-1.5">
                  <TrendingUp className="w-3 h-3 text-red-400" /> Increases bust risk
                </span>
                <span className="flex items-center gap-1.5">
                  <TrendingDown className="w-3 h-3 text-green-400" /> Reduces bust risk
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Historical bust rate by horizon */}
        {bustRateByDay.some((b) => b.count > 0) && (
          <div>
            <div className="text-xs text-storm-400 font-medium uppercase tracking-wider mb-2">
              Historical Bust Rate (30 days) by Horizon
            </div>
            <div className="stat-card rounded-2xl p-4">
              <div className="flex items-end justify-between gap-1 h-32">
                {bustRateByDay.map((b) => (
                  <div key={b.day} className="flex-1 flex flex-col items-center gap-1">
                    <span className="text-xs font-mono text-storm-400">{(b.rate * 100).toFixed(0)}%</span>
                    <div className="w-full flex flex-col justify-end h-20">
                      <div
                        className="w-full rounded-t transition-all duration-500"
                        style={{
                          height: `${b.rate * 100}%`,
                          background: b.rate > 0.3 ? '#ef4444' : b.rate > 0.15 ? '#f59e0b' : '#22c55e',
                          opacity: 0.8,
                          minHeight: b.count > 0 ? '2px' : '0',
                        }}
                      />
                    </div>
                    <span className="text-xs text-storm-500">D{b.day}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ForecastCard({
  icon: Icon,
  label,
  value,
  unit,
  color,
  isText,
}: {
  icon: typeof Thermometer;
  label: string;
  value: number | string;
  unit: string;
  color: string;
  isText?: boolean;
}) {
  return (
    <div className="glass-panel-light rounded-xl p-3">
      <div className="flex items-center gap-2 mb-1.5">
        <Icon className="w-3.5 h-3.5" style={{ color }} />
        <span className="text-xs text-storm-400">{label}</span>
      </div>
      <div className="text-lg font-bold font-mono text-white">
        {isText ? value : typeof value === 'number' ? value.toFixed(1) : value}
        {!isText && unit && <span className="text-sm text-storm-500 ml-1">{unit}</span>}
      </div>
    </div>
  );
}
