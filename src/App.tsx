import { useState, useEffect, useCallback } from 'react';
import { AuthProvider, useAuth } from '@/lib/auth';
import { AuthScreen } from '@/components/AuthScreen';
import { Sidebar, type ViewType } from '@/components/Sidebar';
import { MapDashboard } from '@/components/MapDashboard';
import { MetricsView } from '@/components/MetricsView';
import { AlertsView } from '@/components/AlertsView';
import { supabase, type Alert, type ModelMetric, type GridPoint, type BustHistory, type BustPrediction } from '@/lib/supabase';
import { Loader2 } from 'lucide-react';

function AppInner() {
  const { session, loading } = useAuth();
  const [view, setView] = useState<ViewType>('map');
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [metrics, setMetrics] = useState<ModelMetric[]>([]);
  const [gridPoints, setGridPoints] = useState<GridPoint[]>([]);
  const [bustHistory, setBustHistory] = useState<BustHistory[]>([]);
  const [predictions, setPredictions] = useState<BustPrediction[]>([]);
  const [dataLoading, setDataLoading] = useState(true);

  const loadAlerts = useCallback(async () => {
    if (!session?.user) return;
    const { data } = await supabase
      .from('alerts')
      .select('*')
      .eq('user_id', session.user.id)
      .order('created_at', { ascending: false });
    setAlerts((data || []) as Alert[]);
  }, [session]);

  const loadMetricsData = useCallback(async () => {
    const [metricsRes, gridsRes] = await Promise.all([
      supabase.from('model_metrics').select('*').order('metric_date', { ascending: true }),
      supabase.from('grid_points').select('*'),
    ]);
    setMetrics((metricsRes.data || []) as ModelMetric[]);
    setGridPoints((gridsRes.data || []) as GridPoint[]);

    const today = new Date().toISOString().split('T')[0];
    const [histRes, predsRes] = await Promise.all([
      supabase.from('bust_history').select('*').order('forecast_date', { ascending: false }).limit(5000),
      supabase.from('bust_predictions').select('*').eq('forecast_date', today).eq('model_version', 'xgb-v2.1'),
    ]);
    setBustHistory((histRes.data || []) as BustHistory[]);
    setPredictions((predsRes.data || []) as BustPrediction[]);
    setDataLoading(false);
  }, []);

  useEffect(() => {
    if (session?.user) {
      loadAlerts();
      loadMetricsData();
    }
  }, [session, loadAlerts, loadMetricsData]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0a1929]">
        <Loader2 className="w-8 h-8 text-ocean-400 animate-spin" />
      </div>
    );
  }

  if (!session) {
    return <AuthScreen />;
  }

  const unreadAlertCount = alerts.filter((a) => !a.is_read).length;

  async function handleMarkRead(alertId: string) {
    await supabase.from('alerts').update({ is_read: true }).eq('id', alertId);
    setAlerts((prev) => prev.map((a) => (a.id === alertId ? { ...a, is_read: true } : a)));
  }

  async function handleDeleteAlert(alertId: string) {
    await supabase.from('alerts').delete().eq('id', alertId);
    setAlerts((prev) => prev.filter((a) => a.id !== alertId));
  }

  async function handleMarkAllRead() {
    const unreadIds = alerts.filter((a) => !a.is_read).map((a) => a.id);
    if (unreadIds.length === 0) return;
    await supabase.from('alerts').update({ is_read: true }).in('id', unreadIds);
    setAlerts((prev) => prev.map((a) => ({ ...a, is_read: true })));
  }

  return (
    <div className="flex h-screen overflow-hidden bg-[#0a1929]">
      <Sidebar currentView={view} onViewChange={setView} alertCount={unreadAlertCount} />
      <main className="flex-1 flex flex-col overflow-hidden">
        {view === 'map' && <MapDashboard onAlertCreated={loadAlerts} />}
        {view === 'metrics' && (
          dataLoading ? (
            <div className="flex-1 flex items-center justify-center">
              <Loader2 className="w-8 h-8 text-ocean-400 animate-spin" />
            </div>
          ) : (
            <MetricsView metrics={metrics} bustHistory={bustHistory} predictions={predictions} />
          )
        )}
        {view === 'alerts' && (
          <AlertsView
            alerts={alerts}
            gridPoints={gridPoints}
            onMarkRead={handleMarkRead}
            onDeleteAlert={handleDeleteAlert}
            onMarkAllRead={handleMarkAllRead}
          />
        )}
      </main>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppInner />
    </AuthProvider>
  );
}
