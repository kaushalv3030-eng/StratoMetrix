import { useState } from 'react';
import {
  CloudLightning,
  Shield,
  Mail,
  Lock,
  User,
  Eye,
  EyeOff,
  Fingerprint,
  ChevronRight,
  Activity,
  AlertTriangle,
  CheckCircle2,
  Loader2,
} from 'lucide-react';
import { useAuth } from '@/lib/auth';
import type { UserRole } from '@/lib/supabase';

export function AuthScreen() {
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [role, setRole] = useState<UserRole>('forecaster');
  const [showPassword, setShowPassword] = useState(false);
  const [mfaChecked, setMfaChecked] = useState(false);
  const [biometricChecked, setBiometricChecked] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    if (mode === 'signin') {
      const { error } = await signIn(email, password);
      if (error) setError(error);
    } else {
      if (password.length < 6) {
        setError('Password must be at least 6 characters');
        setLoading(false);
        return;
      }
      const { error } = await signUp(email, password, displayName || email.split('@')[0], role);
      if (error) setError(error);
    }
    setLoading(false);
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden">
      {/* Animated background */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#0a1929] via-[#0c1e35] to-[#081627]" />
      <div
        className="absolute inset-0 opacity-20"
        style={{
          backgroundImage:
            'radial-gradient(circle at 20% 30%, rgba(14,165,233,0.15) 0%, transparent 50%), radial-gradient(circle at 80% 70%, rgba(56,189,248,0.1) 0%, transparent 50%)',
        }}
      />
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: `linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)`,
          backgroundSize: '40px 40px',
        }}
      />

      <div className="relative z-10 w-full max-w-md animate-fade-in">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-ocean-500 to-ocean-700 mb-4 shadow-lg shadow-ocean-500/30">
            <CloudLightning className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">BustGuard AI</h1>
          <p className="text-storm-400 text-sm mt-1">Forecast Bust Prediction &amp; Attribution Platform</p>
        </div>

        {/* Role selection tabs */}
        <div className="glass-panel rounded-2xl p-1.5 mb-6 flex gap-1.5">
          <button
            onClick={() => setMode('signin')}
            className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-all ${
              mode === 'signin' ? 'bg-ocean-600 text-white shadow-lg' : 'text-storm-400 hover:text-white'
            }`}
          >
            Sign In
          </button>
          <button
            onClick={() => setMode('signup')}
            className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-all ${
              mode === 'signup' ? 'bg-ocean-600 text-white shadow-lg' : 'text-storm-400 hover:text-white'
            }`}
          >
            Create Account
          </button>
        </div>

        {/* Form card */}
        <div className="glass-panel rounded-2xl p-6 shadow-2xl">
          {mode === 'signup' && (
            <div className="mb-5">
              <label className="block text-xs font-medium text-storm-300 mb-2 uppercase tracking-wider">
                Select Portal
              </label>
              <div className="grid grid-cols-2 gap-2">
                {(
                  [
                    { value: 'forecaster', label: 'Forecaster', desc: 'Full access' },
                    { value: 'user', label: 'Standard User', desc: 'View only' },
                  ] as { value: UserRole; label: string; desc: string }[]
                ).map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setRole(opt.value)}
                    className={`p-3 rounded-xl border text-left transition-all ${
                      role === opt.value
                        ? 'border-ocean-500 bg-ocean-500/10'
                        : 'border-storm-700/30 hover:border-storm-600/50'
                    }`}
                  >
                    <div className={`text-sm font-semibold ${role === opt.value ? 'text-ocean-300' : 'text-storm-300'}`}>
                      {opt.label}
                    </div>
                    <div className="text-xs text-storm-500 mt-0.5">{opt.desc}</div>
                  </button>
                ))}
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'signup' && (
              <div>
                <label className="block text-xs font-medium text-storm-300 mb-1.5">Display Name</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-storm-500" />
                  <input
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    className="input-field w-full pl-10 pr-4 py-2.5 rounded-xl text-sm"
                    placeholder="Jane Meteorologist"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-storm-300 mb-1.5">Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-storm-500" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="input-field w-full pl-10 pr-4 py-2.5 rounded-xl text-sm"
                  placeholder="analyst@weather.gov"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-storm-300 mb-1.5">Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-storm-500" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="input-field w-full pl-10 pr-10 py-2.5 rounded-xl text-sm"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-storm-500 hover:text-storm-300"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {mode === 'signin' && (
              <div className="space-y-2.5 pt-1">
                <button
                  type="button"
                  onClick={() => setMfaChecked(!mfaChecked)}
                  className={`flex items-center gap-3 w-full p-3 rounded-xl border transition-all ${
                    mfaChecked ? 'border-ocean-500 bg-ocean-500/10' : 'border-storm-700/30'
                  }`}
                >
                  <div className={`flex-shrink-0 w-9 h-9 rounded-lg flex items-center justify-center ${mfaChecked ? 'bg-ocean-500/20' : 'bg-storm-800/50'}`}>
                    <Shield className={`w-4 h-4 ${mfaChecked ? 'text-ocean-400' : 'text-storm-500'}`} />
                  </div>
                  <div className="text-left flex-1">
                    <div className="text-sm font-medium text-storm-200">MFA Verification</div>
                    <div className="text-xs text-storm-500">Multi-factor authentication</div>
                  </div>
                  <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center ${mfaChecked ? 'border-ocean-500 bg-ocean-500' : 'border-storm-600'}`}>
                    {mfaChecked && <CheckCircle2 className="w-3.5 h-3.5 text-white" />}
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setBiometricChecked(!biometricChecked)}
                  className={`flex items-center gap-3 w-full p-3 rounded-xl border transition-all ${
                    biometricChecked ? 'border-ocean-500 bg-ocean-500/10' : 'border-storm-700/30'
                  }`}
                >
                  <div className={`flex-shrink-0 w-9 h-9 rounded-lg flex items-center justify-center ${biometricChecked ? 'bg-ocean-500/20' : 'bg-storm-800/50'}`}>
                    <Fingerprint className={`w-4 h-4 ${biometricChecked ? 'text-ocean-400' : 'text-storm-500'}`} />
                  </div>
                  <div className="text-left flex-1">
                    <div className="text-sm font-medium text-storm-200">Biometric Check</div>
                    <div className="text-xs text-storm-500">Optional fingerprint / face ID</div>
                  </div>
                  <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center ${biometricChecked ? 'border-ocean-500 bg-ocean-500' : 'border-storm-600'}`}>
                    {biometricChecked && <CheckCircle2 className="w-3.5 h-3.5 text-white" />}
                  </div>
                </button>
              </div>
            )}

            {error && (
              <div className="flex items-center gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm animate-slide-up">
                <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full py-2.5 rounded-xl flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  {mode === 'signin' ? 'Access Dashboard' : 'Create Account'}
                  <ChevronRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
        </div>

        {/* Feature badges */}
        <div className="flex items-center justify-center gap-6 mt-6 text-xs text-storm-500">
          <span className="flex items-center gap-1.5">
            <Activity className="w-3.5 h-3.5" />
            10-day horizon
          </span>
          <span className="flex items-center gap-1.5">
            <Shield className="w-3.5 h-3.5" />
            RLS secured
          </span>
          <span className="flex items-center gap-1.5">
            <CloudLightning className="w-3.5 h-3.5" />
            ERA5 trained
          </span>
        </div>
      </div>
    </div>
  );
}
