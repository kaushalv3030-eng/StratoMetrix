import {
  CloudLightning,
  LayoutDashboard,
  Map,
  Bell,
  TrendingUp,
  LogOut,
  ChevronDown,
  Shield,
  Fingerprint,
} from 'lucide-react';
import { useState } from 'react';
import { useAuth } from '@/lib/auth';

export type ViewType = 'map' | 'metrics' | 'alerts';

interface SidebarProps {
  currentView: ViewType;
  onViewChange: (v: ViewType) => void;
  alertCount: number;
}

export function Sidebar({ currentView, onViewChange, alertCount }: SidebarProps) {
  const { profile, signOut } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);

  const navItems: { id: ViewType; label: string; icon: typeof Map; badge?: number }[] = [
    { id: 'map', label: 'Map Dashboard', icon: Map },
    { id: 'metrics', label: 'Model Metrics', icon: TrendingUp },
    { id: 'alerts', label: 'Alerts', icon: Bell, badge: alertCount },
  ];

  const roleLabel = profile?.role === 'admin' ? 'Administrator' : profile?.role === 'forecaster' ? 'Forecaster' : 'Standard User';
  const roleColor = profile?.role === 'admin' ? 'text-red-400' : profile?.role === 'forecaster' ? 'text-ocean-400' : 'text-storm-400';

  return (
    <aside className="w-60 flex-shrink-0 h-screen flex flex-col glass-panel border-r border-storm-700/20 sticky top-0">
      {/* Logo */}
      <div className="p-5 border-b border-storm-700/20">
        <div className="flex items-center gap-3">
          <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-gradient-to-br from-ocean-500 to-ocean-700 flex items-center justify-center shadow-lg shadow-ocean-500/20">
            <CloudLightning className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="text-sm font-bold text-white tracking-tight">BustGuard AI</div>
            <div className="text-xs text-storm-500">v2.1 • XGBoost</div>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 p-3 space-y-1">
        <div className="text-xs text-storm-600 font-medium uppercase tracking-wider px-3 py-2">Navigation</div>
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = currentView === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onViewChange(item.id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                active
                  ? 'bg-ocean-600/20 text-ocean-300 border border-ocean-600/30'
                  : 'text-storm-400 hover:text-white hover:bg-storm-800/40 border border-transparent'
              }`}
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              <span className="flex-1 text-left">{item.label}</span>
              {item.badge !== undefined && item.badge > 0 && (
                <span className="flex-shrink-0 px-2 py-0.5 text-xs font-semibold rounded-full bg-red-500/20 text-red-400 border border-red-500/30">
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* System status */}
      <div className="px-4 py-3 border-t border-storm-700/20">
        <div className="flex items-center gap-2 text-xs">
          <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
          <span className="text-storm-400">NWP Ingestion: Live</span>
        </div>
        <div className="flex items-center gap-2 text-xs mt-1.5">
          <div className="w-2 h-2 rounded-full bg-ocean-400" />
          <span className="text-storm-400">Model: xgb-v2.1 • Active</span>
        </div>
      </div>

      {/* User menu */}
      <div className="p-3 border-t border-storm-700/20 relative">
        <button
          onClick={() => setMenuOpen(!menuOpen)}
          className="w-full flex items-center gap-3 p-2 rounded-xl hover:bg-storm-800/40 transition-all"
        >
          <div
            className="w-9 h-9 rounded-lg flex items-center justify-center text-white text-sm font-bold flex-shrink-0"
            style={{ background: profile?.avatar_color || '#0ea5e9' }}
          >
            {(profile?.display_name || 'U').charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 text-left min-w-0">
            <div className="text-sm font-medium text-white truncate">{profile?.display_name}</div>
            <div className={`text-xs ${roleColor}`}>{roleLabel}</div>
          </div>
          <ChevronDown className="w-4 h-4 text-storm-500 flex-shrink-0" />
        </button>

        {menuOpen && (
          <div className="absolute bottom-16 left-3 right-3 glass-panel rounded-xl p-2 shadow-2xl animate-slide-up z-20">
            <div className="px-3 py-2 border-b border-storm-700/20 mb-1">
              <div className="text-xs text-storm-500">{profile?.email}</div>
              <div className="flex items-center gap-3 mt-2">
                {profile?.mfa_enabled && (
                  <span className="flex items-center gap-1 text-xs text-green-400">
                    <Shield className="w-3 h-3" /> MFA
                  </span>
                )}
                {profile?.biometric_enabled && (
                  <span className="flex items-center gap-1 text-xs text-green-400">
                    <Fingerprint className="w-3 h-3" /> Bio
                  </span>
                )}
              </div>
            </div>
            <button
              onClick={() => {
                signOut();
                setMenuOpen(false);
              }}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-storm-400 hover:text-red-400 hover:bg-red-500/10 transition-all"
            >
              <LogOut className="w-4 h-4" />
              Sign Out
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}
