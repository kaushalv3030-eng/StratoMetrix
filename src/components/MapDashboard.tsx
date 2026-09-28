import { useState, useEffect, useCallback } from 'react';
import {
  CloudRain,
  Thermometer,
  Gauge,
  Wind,
  AlertTriangle,
  TrendingUp,
  Globe,
  Loader2,
  Zap,
  Activity,
  Send,
} from 'lucide-react';
import { supabase, type GridPoint, type BustPrediction, type Forecast, type FeatureAttribution, type BustHistory, type Alert as AlertType } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { WorldMap } from './WorldMap';
import { GridDetailPanel } from './GridDetailPanel';
import { summarizeGridBusts, type GridBustSummary, computeBustScore } from '@/lib/mlEngine';
import { probColor } from './WorldMap';

interface MapDashboardProps {
  onAlertCreated: () => void;
}

export function MapDashboard({ onAlertCreated }: MapDashboardProps) {
  const { profile } = useAuth();
  const [gridPoints, setGridPoints] = useState<GridPoint[]>([]);
  const [predictions, setPredictions] = useState<BustPrediction[]>([]);
  const [forecasts, setForecasts] = useState<Forecast[]>([]);
  const [allAttributions, setAllAttributions] = useState<FeatureAttribution[]>([]);
  const [bustHistory, setBustHistory] = useState<BustHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedGridId, setSelectedGridId] = useState<string | null>(null);
  const [horizonDay, setHorizonDay] = useState(1);
  const [showAlertModal, setShowAlertModal] = useState<BustPrediction | null>(null);
  const [creatingAlert, setCreatingAlert] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    const today = new Date().toISOString().split('T')[0];

    const [gridsRes, predsRes, forecastsRes] = await Promise.all([
      supabase.from('grid_points').select('*').order('region'),
      supabase.from('bust_predictions').select('*').eq('forecast_date', today).eq('model_version', 'xgb-v2.1'),
      supabase.from('forecasts').select('*').eq('forecast_date', today).eq('model_source', 'GFS'),
    ]);

    const grids = (gridsRes.data || []) as GridPoint[];
    const preds = (predsRes.data || []) as BustPrediction[];
    const fcs = (forecastsRes.data || []) as Forecast[];

    setGridPoints(grids);
    setPredictions(preds);
    setForecasts(fcs);

    // Fetch attributions for all predictions
    if (preds.length > 0) {
      const predIds = preds.map((p) => p.id);
      const { data: attrData } = await supabase
        .from('feature_attributions')
        .select('*')
        .in('bust_prediction_id', predIds);
      setAllAttributions((attrData || []) as FeatureAttribution[]);
    }

    // Fetch recent bust history for the selected grid (loaded on demand in panel)
    // For the metrics summary, load a subset
    const { data: histData } = await supabase
      .from('bust_history')
      .select('*')
      .order('forecast_date', { ascending: false })
      .limit(3000);
    setBustHistory((histData || []) as BustHistory[]);

    setLoading(false);
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Build grid summaries for the map
  const gridSummaries: GridBustSummary[] = gridPoints.map((gp) => {
    const gpPreds = predictions.filter((p) => p.grid_point_id === gp.id);
    return summarizeGridBusts(gp, gpPreds);
  });

  const selectedGrid = gridPoints.find((g) => g.id === selectedGridId);
  const selectedPreds = selectedGridId ? predictions.filter((p) => p.grid_point_id === selectedGridId) : [];
  const selectedForecasts = selectedGridId ? forecasts.filter((f) => f.grid_point_id === selectedGridId) : [];
  const selectedHistory = selectedGridId ? bustHistory.filter((h) => h.grid_point_id === selectedGridId) : [];

  // Top-level stats
  const totalGrids = gridPoints.length;
  const currentDayPreds = predictions.filter((p) => p.horizon_day === horizonDay);
  const highRiskCount = currentDayPreds.filter((p) => p.risk_level === 'high' || p.risk_level === 'critical').length;
  const criticalCount = currentDayPreds.filter((p) => p.risk_level === 'critical').length;
  const avgBustProb = currentDayPreds.length > 0
    ? currentDayPreds.reduce((s, p) => s + p.bust_probability, 0) / currentDayPreds.length
    : 0;

  // Top risk grids for current horizon
  const topRiskGrids = [...gridSummaries]
    .map((gs) => {
      const pred = gs.predictions.find((p) => p.horizon_day === horizonDay);
      return { gs, prob: pred?.bust_probability ?? 0, riskLevel: pred?.risk_level ?? 'low' };
    })
    .sort((a, b) => b.prob - a.prob)
    .slice(0, 5);

  async function handleCreateAlert(pred: BustPrediction) {
    setShowAlertModal(pred);
  }

  async function confirmCreateAlert(channel: 'in_app' | 'sms' | 'webhook' | 'email') {
    if (!showAlertModal || !profile) return;
    setCreatingAlert(true);
    const grid = gridPoints.find((g) => g.id === showAlertModal.grid_point_id);
    const riskLabel = showAlertModal.risk_level.toUpperCase();

    const { error } = await supabase.from('alerts').insert({
      user_id: profile.id,
      grid_point_id: showAlertModal.grid_point_id,
      bust_prediction_id: showAlertModal.id,
      title: `${riskLabel} Bust Risk — ${grid?.region || 'Unknown Grid'}`,
      message: `Day ${showAlertModal.horizon_day} forecast for ${grid?.grid_id} (${grid?.region}) has a ${(showAlertModal.bust_probability * 100).toFixed(1)}% bust probability. Confidence: ${(showAlertModal.confidence_score * 100).toFixed(0)}%. Recommend operational review of this grid point.`,
      risk_level: showAlertModal.risk_level,
      delivery_channel: channel,
      is_dispatched: channel !== 'in_app',
    });

    setCreatingAlert(false);
    setShowAlertModal(null);
    if (!error) {
      onAlertCreated();
    }
  }

  // Run live bust score inference for the selected grid using the ML engine
  const liveScore = selectedGrid && selectedForecasts.length > 0 && selectedPreds.length > 0
    ? computeBustScore(
        selectedForecasts.find((f) => f.horizon_day === horizonDay) || selectedForecasts[0],
        horizonDay,
        allAttributions.filter((a) => {
          const pred = selectedPreds.find((p) => p.horizon_day === horizonDay);
          return pred && a.bust_prediction_id === pred.id;
        }),
      )
    : null;

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 text-ocean-400 animate-spin mx-auto mb-3" />
          <p className="text-storm-400 text-sm">Ingesting NWP data &amp; running AI inference...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden animate-fade-in">
      {/* Top stat bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 p-4 pb-2">
        <StatPill icon={Globe} label="Active Grids" value={totalGrids.toString()} color="#0ea5e9" />
        <StatPill icon={AlertTriangle} label={`High Risk (D${horizonDay})`} value={highRiskCount.toString()} color="#f97316" />
        <StatPill icon={Zap} label="Critical Zones" value={criticalCount.toString()} color="#ef4444" />
        <StatPill icon={Activity} label="Avg Bust Prob" value={`${(avgBustProb * 100).toFixed(1)}%`} color={probColor(avgBustProb)} />
      </div>

      <div className="flex-1 flex overflow-hidden px-4 pb-4 gap-4">
        {/* Map + controls */}
        <div className="flex-1 flex flex-col gap-3 min-w-0">
          {/* Horizon day slider */}
          <div className="glass-panel rounded-2xl p-3 flex items-center gap-4">
            <div className="flex items-center gap-2 flex-shrink-0">
              <TrendingUp className="w-4 h-4 text-ocean-400" />
              <span className="text-sm font-medium text-storm-200">Forecast Horizon</span>
            </div>
            <div className="flex-1 flex items-center gap-2">
              <span className="text-xs text-storm-500 font-mono">D1</span>
              <input
                type="range"
                min={1}
                max={10}
                value={horizonDay}
                onChange={(e) => setHorizonDay(parseInt(e.target.value))}
                className="flex-1 accent-ocean-500"
              />
              <span className="text-xs text-storm-500 font-mono">D10</span>
            </div>
            <div className="flex-shrink-0 px-3 py-1 rounded-lg bg-ocean-600/20 border border-ocean-600/30">
              <span className="text-sm font-bold text-ocean-300 font-mono">Day {horizonDay}</span>
            </div>
          </div>

          {/* Map */}
          <div className="flex-1 glass-panel rounded-2xl p-2 relative overflow-hidden min-h-[400px]">
            <WorldMap
              gridSummaries={gridSummaries}
              selectedGridId={selectedGridId}
              onSelectGrid={setSelectedGridId}
              horizonDay={horizonDay}
            />
          </div>

          {/* Top risk grids */}
          <div className="glass-panel rounded-2xl p-4">
            <h3 className="text-sm font-semibold text-white mb-3">Top Risk Zones — Day {horizonDay}</h3>
            <div className="space-y-2">
              {topRiskGrids.map(({ gs, prob, riskLevel }, idx) => (
                <button
                  key={gs.gridPoint.id}
                  onClick={() => setSelectedGridId(gs.gridPoint.id)}
                  className={`w-full flex items-center gap-3 p-2 rounded-xl transition-all ${
                    selectedGridId === gs.gridPoint.id ? 'bg-ocean-600/15 border border-ocean-600/30' : 'hover:bg-storm-800/30 border border-transparent'
                  }`}
                >
                  <span className="text-xs font-mono text-storm-600 w-5">{idx + 1}</span>
                  <div className="flex-1 text-left min-w-0">
                    <span className="text-sm text-storm-200 truncate">{gs.gridPoint.region}</span>
                    <span className="text-xs text-storm-500 ml-2 font-mono">{gs.gridPoint.grid_id}</span>
                  </div>
                  <div className="w-24 h-1.5 rounded-full bg-storm-900/50 overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${prob * 100}%`, background: probColor(prob) }} />
                  </div>
                  <span className="text-sm font-bold font-mono w-12 text-right" style={{ color: probColor(prob) }}>
                    {(prob * 100).toFixed(0)}%
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Detail panel */}
        {selectedGrid ? (
          <div className="w-[420px] flex-shrink-0 glass-panel rounded-2xl overflow-hidden">
            <GridDetailPanel
              gridPoint={selectedGrid}
              predictions={selectedPreds}
              forecasts={selectedForecasts}
              attributions={allAttributions}
              bustHistory={selectedHistory}
              onClose={() => setSelectedGridId(null)}
              onCreateAlert={handleCreateAlert}
            />
          </div>
        ) : (
          <div className="w-[420px] flex-shrink-0 glass-panel rounded-2xl flex items-center justify-center p-8">
            <div className="text-center">
              <Globe className="w-12 h-12 text-storm-700 mx-auto mb-3" />
              <p className="text-storm-400 text-sm">Select a grid point on the map</p>
              <p className="text-xs text-storm-600 mt-1">View bust probability, NWP parameters, and feature attribution</p>
            </div>
          </div>
        )}
      </div>

      {/* Alert creation modal */}
      {showAlertModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 animate-fade-in"
          onClick={() => !creatingAlert && setShowAlertModal(null)}
        >
          <div
            className="glass-panel rounded-2xl p-6 max-w-md w-full animate-slide-up"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 mb-4">
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center"
                style={{ background: `${probColor(showAlertModal.bust_probability)}15` }}
              >
                <AlertTriangle className="w-6 h-6" style={{ color: probColor(showAlertModal.bust_probability) }} />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">Dispatch Risk Alert</h3>
                <p className="text-xs text-storm-400">
                  {(showAlertModal.bust_probability * 100).toFixed(1)}% bust probability — Day {showAlertModal.horizon_day}
                </p>
              </div>
            </div>

            <p className="text-sm text-storm-400 mb-4">
              Select delivery channel to notify stakeholders of this forecast bust risk zone:
            </p>

            <div className="grid grid-cols-2 gap-2 mb-4">
              {([
                { id: 'in_app', label: 'In-App', icon: Activity },
                { id: 'sms', label: 'SMS', icon: Send },
                { id: 'webhook', label: 'Webhook', icon: Zap },
                { id: 'email', label: 'Email', icon: Send },
              ] as const).map((ch) => {
                const Icon = ch.icon;
                return (
                  <button
                    key={ch.id}
                    onClick={() => confirmCreateAlert(ch.id)}
                    disabled={creatingAlert}
                    className="flex items-center gap-2 p-3 rounded-xl border border-storm-700/30 hover:border-ocean-500/50 hover:bg-ocean-500/5 transition-all disabled:opacity-50"
                  >
                    <Icon className="w-4 h-4 text-ocean-400" />
                    <span className="text-sm text-storm-200">{ch.label}</span>
                  </button>
                );
              })}
            </div>

            {creatingAlert && (
              <div className="flex items-center justify-center gap-2 text-sm text-ocean-400">
                <Loader2 className="w-4 h-4 animate-spin" />
                Dispatching alert...
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function StatPill({ icon: Icon, label, value, color }: { icon: typeof Globe; label: string; value: string; color: string }) {
  return (
    <div className="stat-card rounded-2xl p-3 flex items-center gap-3">
      <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: `${color}15` }}>
        <Icon className="w-4 h-4" style={{ color }} />
      </div>
      <div className="min-w-0">
        <div className="text-lg font-bold font-mono text-white leading-tight">{value}</div>
        <div className="text-xs text-storm-500 truncate">{label}</div>
      </div>
    </div>
  );
}
