import { useMemo } from 'react';
import {
  TrendingUp,
  Target,
  AlertCircle,
  Zap,
  Award,
  Activity,
  Cpu,
  Database,
} from 'lucide-react';
import type { ModelMetric, BustHistory, BustPrediction } from '@/lib/supabase';
import { computeROCAUC, computeBrierScore, computeFalseAlarmRate } from '@/lib/mlEngine';

interface MetricsViewProps {
  metrics: ModelMetric[];
  bustHistory: BustHistory[];
  predictions: BustPrediction[];
}

export function MetricsView({ metrics, bustHistory, predictions }: MetricsViewProps) {
  const latestMetrics = useMemo(() => {
    const v21 = metrics.filter((m) => m.model_version === 'xgb-v2.1').sort((a, b) => b.metric_date.localeCompare(a.metric_date));
    const v10 = metrics.filter((m) => m.model_version === 'xgb-v1.0').sort((a, b) => b.metric_date.localeCompare(a.metric_date));
    return { v21: v21[0], v10: v10[0], v21Series: v21.reverse(), v10Series: v10.reverse() };
  }, [metrics]);

  // Live computed metrics from actual data
  const liveMetrics = useMemo(() => {
    // Match predictions with bust history by grid + horizon for calibration
    const matched: { probability: number; actual: number }[] = [];
    for (const pred of predictions) {
      const histRecords = bustHistory.filter(
        (h) => h.grid_point_id === pred.grid_point_id && h.horizon_day === pred.horizon_day,
      );
      for (const h of histRecords) {
        matched.push({ probability: pred.bust_probability, actual: h.is_bust });
      }
    }
    return {
      rocAuc: computeROCAUC(matched),
      brier: computeBrierScore(matched),
      far: computeFalseAlarmRate(matched, 0.5),
      sampleSize: matched.length,
    };
  }, [predictions, bustHistory]);

  const bustDistribution = useMemo(() => {
    const dist = { extreme: 0, severe: 0, moderate: 0, minor: 0, reliable: 0 };
    for (const h of bustHistory) {
      dist[h.bust_severity as keyof typeof dist]++;
    }
    const total = bustHistory.length || 1;
    return {
      extreme: dist.extreme,
      severe: dist.severe,
      moderate: dist.moderate,
      minor: dist.minor,
      reliable: dist.reliable,
      total,
      bustPct: ((dist.extreme + dist.severe + dist.moderate + dist.minor) / total) * 100,
    };
  }, [bustHistory]);

  const horizonBustRates = useMemo(() => {
    const result: { day: number; rate: number; count: number }[] = [];
    for (let d = 1; d <= 10; d++) {
      const records = bustHistory.filter((h) => h.horizon_day === d);
      const busts = records.filter((h) => h.is_bust === 1).length;
      result.push({ day: d, rate: records.length > 0 ? busts / records.length : 0, count: records.length });
    }
    return result;
  }, [bustHistory]);

  const maxRate = Math.max(...horizonBustRates.map((h) => h.rate), 0.001);

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Model Performance &amp; Validation</h1>
        <p className="text-storm-400 text-sm mt-1">
          Evaluation metrics for the XGBoost bust classifier — ROC-AUC, Brier Score, and False Alarm Rate tracking
        </p>
      </div>

      {/* Key metric cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          icon={Target}
          label="ROC-AUC"
          value={liveMetrics.rocAuc.toFixed(4)}
          desc="Classifier discrimination"
          color="#0ea5e9"
          benchmark={latestMetrics.v21?.roc_auc}
        />
        <MetricCard
          icon={Activity}
          label="Brier Score"
          value={liveMetrics.brier.toFixed(4)}
          desc="Probabilistic calibration"
          color="#22c55e"
          benchmark={latestMetrics.v21?.brier_score}
          lowerIsBetter
        />
        <MetricCard
          icon={AlertCircle}
          label="False Alarm Rate"
          value={(liveMetrics.far * 100).toFixed(1) + '%'}
          desc="FAR at 0.5 threshold"
          color="#f59e0b"
          benchmark={latestMetrics.v21?.false_alarm_rate ? latestMetrics.v21.false_alarm_rate * 100 : undefined}
          lowerIsBetter
        />
        <MetricCard
          icon={Database}
          label="Training Samples"
          value={(latestMetrics.v21?.training_samples ?? 0).toLocaleString()}
          desc="ERA5 + NWP records"
          color="#688fb5"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* ROC-AUC trend chart */}
        <div className="stat-card rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-semibold text-white">ROC-AUC Trend (30 days)</h3>
              <p className="text-xs text-storm-500 mt-0.5">Model discrimination over time</p>
            </div>
            <div className="flex items-center gap-3 text-xs">
              <span className="flex items-center gap-1.5 text-ocean-400">
                <div className="w-2 h-2 rounded-full bg-ocean-500" /> v2.1
              </span>
              <span className="flex items-center gap-1.5 text-storm-400">
                <div className="w-2 h-2 rounded-full bg-storm-500" /> v1.0
              </span>
            </div>
          </div>
          <LineChart
            series={[
              { data: latestMetrics.v21Series.map((m) => m.roc_auc), color: '#0ea5e9' },
              { data: latestMetrics.v10Series.map((m) => m.roc_auc), color: '#48709a' },
            ]}
            yMin={0.6}
            yMax={1.0}
            height={180}
          />
        </div>

        {/* Brier score trend */}
        <div className="stat-card rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-semibold text-white">Brier Score Trend (30 days)</h3>
              <p className="text-xs text-storm-500 mt-0.5">Lower is better — calibration reliability</p>
            </div>
            <div className="flex items-center gap-3 text-xs">
              <span className="flex items-center gap-1.5 text-green-400">
                <div className="w-2 h-2 rounded-full bg-green-500" /> v2.1
              </span>
              <span className="flex items-center gap-1.5 text-storm-400">
                <div className="w-2 h-2 rounded-full bg-storm-500" /> v1.0
              </span>
            </div>
          </div>
          <LineChart
            series={[
              { data: latestMetrics.v21Series.map((m) => m.brier_score), color: '#22c55e' },
              { data: latestMetrics.v10Series.map((m) => m.brier_score), color: '#48709a' },
            ]}
            yMin={0}
            yMax={0.25}
            height={180}
          />
        </div>

        {/* FAR trend */}
        <div className="stat-card rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-semibold text-white">False Alarm Rate Trend</h3>
              <p className="text-xs text-storm-500 mt-0.5">Lower is better — operational reliability</p>
            </div>
          </div>
          <LineChart
            series={[
              { data: latestMetrics.v21Series.map((m) => m.false_alarm_rate), color: '#f59e0b' },
              { data: latestMetrics.v10Series.map((m) => m.false_alarm_rate), color: '#48709a' },
            ]}
            yMin={0}
            yMax={0.35}
            height={180}
          />
        </div>

        {/* Bust severity distribution */}
        <div className="stat-card rounded-2xl p-5">
          <h3 className="text-sm font-semibold text-white mb-1">Bust Severity Distribution</h3>
          <p className="text-xs text-storm-500 mb-4">Ground truth from {bustDistribution.total.toLocaleString()} historical records</p>
          <div className="space-y-3">
            <SeverityBar label="Extreme" count={bustDistribution.extreme} total={bustDistribution.total} color="#ef4444" />
            <SeverityBar label="Severe" count={bustDistribution.severe} total={bustDistribution.total} color="#f97316" />
            <SeverityBar label="Moderate" count={bustDistribution.moderate} total={bustDistribution.total} color="#f59e0b" />
            <SeverityBar label="Minor" count={bustDistribution.minor} total={bustDistribution.total} color="#eab308" />
            <SeverityBar label="Reliable" count={bustDistribution.reliable} total={bustDistribution.total} color="#22c55e" />
          </div>
          <div className="mt-4 pt-3 border-t border-storm-700/20 flex items-center justify-between">
            <span className="text-xs text-storm-400">Overall Bust Rate</span>
            <span className="text-lg font-bold font-mono text-orange-400">{bustDistribution.bustPct.toFixed(1)}%</span>
          </div>
        </div>
      </div>

      {/* Horizon bust rate chart */}
      <div className="stat-card rounded-2xl p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-semibold text-white">Bust Rate by Forecast Horizon</h3>
            <p className="text-xs text-storm-500 mt-0.5">Error frequency increases with lead time — characteristic NWP behavior</p>
          </div>
          <Zap className="w-5 h-5 text-ocean-400" />
        </div>
        <div className="flex items-end justify-between gap-2 h-40">
          {horizonBustRates.map((h) => (
            <div key={h.day} className="flex-1 flex flex-col items-center gap-1.5">
              <span className="text-xs font-mono text-storm-300">{(h.rate * 100).toFixed(1)}%</span>
              <div className="w-full flex flex-col justify-end h-28 relative group">
                <div
                  className="w-full rounded-t-md transition-all duration-500 hover:opacity-90"
                  style={{
                    height: `${(h.rate / maxRate) * 100}%`,
                    background: h.rate > 0.3 ? 'linear-gradient(180deg, #ef4444 0%, #f97316 100%)' :
                               h.rate > 0.15 ? 'linear-gradient(180deg, #f59e0b 0%, #eab308 100%)' :
                               'linear-gradient(180deg, #22c55e 0%, #16a34a 100%)',
                    minHeight: h.count > 0 ? '4px' : '0',
                  }}
                />
              </div>
              <span className="text-xs text-storm-500 font-medium">Day {h.day}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Model architecture info */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <InfoCard icon={Cpu} title="Model Architecture" items={[
          { label: 'Algorithm', value: 'XGBoost Classifier' },
          { label: 'Version', value: 'xgb-v2.1' },
          { label: 'Trees', value: '500' },
          { label: 'Max depth', value: '8' },
          { label: 'Learning rate', value: '0.05' },
        ]} />
        <InfoCard icon={Database} title="Training Data" items={[
          { label: 'Source', value: 'ERA5 Reanalysis' },
          { label: 'NWP Models', value: 'GFS + ECMWF IFS' },
          { label: 'Grid points', value: '30 global' },
          { label: 'Horizon', value: '1–10 days' },
          { label: 'Features', value: '8 meteorological' },
        ]} />
        <InfoCard icon={Award} title="Validation" items={[
          { label: 'ROC-AUC', value: liveMetrics.rocAuc.toFixed(4) },
          { label: 'Brier Score', value: liveMetrics.brier.toFixed(4) },
          { label: 'FAR (0.5)', value: (liveMetrics.far * 100).toFixed(1) + '%' },
          { label: 'Eval samples', value: liveMetrics.sampleSize.toLocaleString() },
          { label: 'Cross-val', value: '5-fold stratified' },
        ]} />
      </div>

      {/* Academic references */}
      <div className="stat-card rounded-2xl p-5">
        <h3 className="text-sm font-semibold text-white mb-3">Academic References &amp; Datasets</h3>
        <div className="space-y-2 text-xs text-storm-400">
          <RefItem text="Vannitsem, S., et al. (2021). Statistical postprocessing for weather forecasts: Review, challenges, and avenues in a big data world. Reviews of Geophysics." />
          <RefItem text="Lam, R., et al. (2023). Learning skillful medium-range global weather forecasting — GraphCast. Science." />
          <RefItem text="Bi, K., et al. (2023). Accurate medium-range global weather forecasting with 3D neural networks (Pangu-Weather). Nature." />
          <RefItem text="ERA5 Reanalysis (ECMWF) — Copernicus Climate Data Store. Historical atmospheric truth parameters." />
          <RefItem text="GFS & ECMWF IFS — Operational NWP gridded predictions for surface pressure, winds, and humidity anomalies." />
        </div>
      </div>
    </div>
  );
}

function MetricCard({
  icon: Icon,
  label,
  value,
  desc,
  color,
  benchmark,
  lowerIsBetter,
}: {
  icon: typeof Target;
  label: string;
  value: string;
  desc: string;
  color: string;
  benchmark?: number;
  lowerIsBetter?: boolean;
}) {
  const diff = benchmark !== undefined ? null : null;
  return (
    <div className="stat-card rounded-2xl p-5">
      <div className="flex items-center justify-between mb-3">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: `${color}15` }}>
          <Icon className="w-5 h-5" style={{ color }} />
        </div>
        {benchmark !== undefined && (
          <span className="text-xs text-storm-500">
            Target: <span className="font-mono text-storm-300">{lowerIsBetter ? '≤' : '≥'} {benchmark.toFixed(3)}</span>
          </span>
        )}
      </div>
      <div className="text-2xl font-bold font-mono text-white">{value}</div>
      <div className="text-sm text-storm-400 mt-1">{label}</div>
      <div className="text-xs text-storm-600 mt-0.5">{desc}</div>
      {diff}
    </div>
  );
}

function LineChart({
  series,
  yMin,
  yMax,
  height,
}: {
  series: { data: number[]; color: string }[];
  yMin: number;
  yMax: number;
  height: number;
}) {
  const width = 400;
  const padding = 20;
  const chartW = width - padding * 2;
  const chartH = height - padding * 2;
  const n = Math.max(...series.map((s) => s.data.length), 1);

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full" style={{ height }}>
      {/* Grid lines */}
      {[0, 0.25, 0.5, 0.75, 1].map((t) => {
        const y = padding + chartH * t;
        return <line key={t} x1={padding} y1={y} x2={width - padding} y2={y} stroke="rgba(72,112,154,0.1)" strokeWidth={0.5} />;
      })}
      {/* Y-axis labels */}
      {[0, 0.25, 0.5, 0.75, 1].map((t) => {
        const y = padding + chartH * t;
        const val = yMax - (yMax - yMin) * t;
        return <text key={t} x={padding - 4} y={y + 3} textAnchor="end" fontSize={9} fill="#48709a" className="font-mono">{val.toFixed(2)}</text>;
      })}

      {series.map((s, si) => {
        if (s.data.length === 0) return null;
        const points = s.data.map((v, i) => {
          const x = padding + (i / (n - 1)) * chartW;
          const y = padding + chartH * (1 - (v - yMin) / (yMax - yMin));
          return `${x},${y}`;
        });
        const pathD = `M ${points.join(' L ')}`;
        const areaD = `${pathD} L ${padding + chartW},${padding + chartH} L ${padding},${padding + chartH} Z`;
        return (
          <g key={si}>
            <path d={areaD} fill={s.color} opacity={0.08} />
            <path d={pathD} fill="none" stroke={s.color} strokeWidth={2} opacity={0.9} strokeLinejoin="round" strokeLinecap="round" />
            {s.data.map((v, i) => {
              const x = padding + (i / (n - 1)) * chartW;
              const y = padding + chartH * (1 - (v - yMin) / (yMax - yMin));
              return <circle key={i} cx={x} cy={y} r={1.5} fill={s.color} opacity={0.6} />;
            })}
          </g>
        );
      })}
    </svg>
  );
}

function SeverityBar({ label, count, total, color }: { label: string; count: number; total: number; color: string }) {
  const pct = (count / total) * 100;
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-storm-300 w-20">{label}</span>
      <div className="flex-1 h-5 rounded-md bg-storm-900/40 overflow-hidden">
        <div className="h-full rounded-md transition-all duration-500" style={{ width: `${pct}%`, background: color, opacity: 0.8 }} />
      </div>
      <span className="text-xs font-mono text-storm-400 w-16 text-right">{count.toLocaleString()}</span>
      <span className="text-xs font-mono text-storm-500 w-12 text-right">{pct.toFixed(1)}%</span>
    </div>
  );
}

function InfoCard({ icon: Icon, title, items }: { icon: typeof Cpu; title: string; items: { label: string; value: string }[] }) {
  return (
    <div className="stat-card rounded-2xl p-4">
      <div className="flex items-center gap-2 mb-3">
        <Icon className="w-4 h-4 text-ocean-400" />
        <h4 className="text-sm font-semibold text-white">{title}</h4>
      </div>
      <div className="space-y-2">
        {items.map((item) => (
          <div key={item.label} className="flex items-center justify-between text-xs">
            <span className="text-storm-500">{item.label}</span>
            <span className="font-mono text-storm-200">{item.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function RefItem({ text }: { text: string }) {
  return (
    <div className="flex items-start gap-2">
      <TrendingUp className="w-3 h-3 text-ocean-500 flex-shrink-0 mt-0.5" />
      <span>{text}</span>
    </div>
  );
}
