import { useState } from 'react';
import {
  Bell,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Info,
  Trash2,
  Check,
  Zap,
  MessageSquare,
  Webhook,
  Mail,
  Filter,
} from 'lucide-react';
import type { Alert, GridPoint } from '@/lib/supabase';
import { riskColor } from './WorldMap';

interface AlertsViewProps {
  alerts: Alert[];
  gridPoints: GridPoint[];
  onMarkRead: (alertId: string) => void;
  onDeleteAlert: (alertId: string) => void;
  onMarkAllRead: () => void;
}

const CHANNEL_ICONS = {
  in_app: Bell,
  sms: MessageSquare,
  webhook: Webhook,
  email: Mail,
};

const RISK_ICONS = {
  critical: XCircle,
  high: AlertTriangle,
  moderate: Zap,
  low: Info,
};

export function AlertsView({ alerts, gridPoints, onMarkRead, onDeleteAlert, onMarkAllRead }: AlertsViewProps) {
  const [filter, setFilter] = useState<'all' | 'unread' | 'critical' | 'high'>('all');

  const filtered = alerts.filter((a) => {
    if (filter === 'unread') return !a.is_read;
    if (filter === 'critical') return a.risk_level === 'critical';
    if (filter === 'high') return a.risk_level === 'high' || a.risk_level === 'critical';
    return true;
  });

  const unreadCount = alerts.filter((a) => !a.is_read).length;
  const criticalCount = alerts.filter((a) => a.risk_level === 'critical').length;

  const gridMap = new Map(gridPoints.map((g) => [g.id, g]));

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Alert Center</h1>
          <p className="text-storm-400 text-sm mt-1">
            {unreadCount} unread • {criticalCount} critical • Automated risk notifications
          </p>
        </div>
        {unreadCount > 0 && (
          <button
            onClick={onMarkAllRead}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium bg-ocean-600/20 text-ocean-300 border border-ocean-600/30 hover:bg-ocean-600/30 transition-all"
          >
            <Check className="w-4 h-4" />
            Mark all read
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2">
        <Filter className="w-4 h-4 text-storm-500" />
        {([
          { id: 'all', label: 'All' },
          { id: 'unread', label: `Unread (${unreadCount})` },
          { id: 'critical', label: `Critical (${criticalCount})` },
          { id: 'high', label: 'High+' },
        ] as const).map((f) => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              filter === f.id ? 'bg-ocean-600/20 text-ocean-300 border border-ocean-600/30' : 'text-storm-400 hover:text-white border border-transparent'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Alert list */}
      {filtered.length === 0 ? (
        <div className="stat-card rounded-2xl p-12 text-center">
          <Bell className="w-12 h-12 text-storm-700 mx-auto mb-3" />
          <p className="text-storm-400">No alerts in this category</p>
          <p className="text-xs text-storm-600 mt-1">Risk alerts will appear here when the AI detects high bust probability zones</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((alert) => {
            const RiskIcon = RISK_ICONS[alert.risk_level];
            const ChannelIcon = CHANNEL_ICONS[alert.delivery_channel];
            const grid = alert.grid_point_id ? gridMap.get(alert.grid_point_id) : null;
            const color = riskColor(alert.risk_level);
            return (
              <div
                key={alert.id}
                className={`stat-card rounded-2xl p-4 transition-all ${!alert.is_read ? 'border-l-4' : ''}`}
                style={!alert.is_read ? { borderLeftColor: color } : {}}
              >
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: `${color}15` }}>
                    <RiskIcon className="w-5 h-5" style={{ color }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-sm font-semibold text-white">{alert.title}</h3>
                      <span
                        className="risk-badge text-xs"
                        style={{ background: `${color}20`, color, border: `1px solid ${color}40` }}
                      >
                        {alert.risk_level}
                      </span>
                      {!alert.is_read && (
                        <span className="w-2 h-2 rounded-full bg-ocean-400 animate-pulse flex-shrink-0" />
                      )}
                    </div>
                    <p className="text-sm text-storm-400 mt-1">{alert.message}</p>
                    <div className="flex items-center gap-4 mt-2 text-xs text-storm-500">
                      {grid && (
                        <span className="flex items-center gap-1">
                          <span className="font-mono">{grid.grid_id}</span>
                          <span>•</span>
                          <span>{grid.region}</span>
                        </span>
                      )}
                      <span className="flex items-center gap-1">
                        <ChannelIcon className="w-3 h-3" />
                        {alert.delivery_channel.replace('_', '-')}
                      </span>
                      <span>{new Date(alert.created_at).toLocaleString()}</span>
                      {alert.is_dispatched && (
                        <span className="flex items-center gap-1 text-green-400">
                          <CheckCircle2 className="w-3 h-3" /> Dispatched
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    {!alert.is_read && (
                      <button
                        onClick={() => onMarkRead(alert.id)}
                        className="p-2 rounded-lg text-storm-500 hover:text-green-400 hover:bg-green-500/10 transition-all"
                        title="Mark as read"
                      >
                        <Check className="w-4 h-4" />
                      </button>
                    )}
                    <button
                      onClick={() => onDeleteAlert(alert.id)}
                      className="p-2 rounded-lg text-storm-500 hover:text-red-400 hover:bg-red-500/10 transition-all"
                      title="Delete alert"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
