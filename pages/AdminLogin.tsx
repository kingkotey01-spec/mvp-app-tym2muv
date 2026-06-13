import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { loginWithEmail } from '../services/supabaseService';
import { supabase } from '../supabaseClient';
import Icon from '../components/Icon';
import { Logo } from '../components/Logo';

const AdminLogin: React.FC = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleAdminSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError('Please provide both administrative email and passcode.');
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      // Live Supabase Authenticator
      const loginResult = await loginWithEmail(email, password, 'Admin');
      const userId = loginResult.id || loginResult.uid;

      if (!userId) {
        throw new Error('Authentication completed but no user identifier was returned.');
      }

      // Direct Database RBAC check: Only allow accounts tagged as 'Admin' or 'admin' in profiles
      const { data: profile, error: profileErr } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', userId)
        .single();

      const normalizedRole = profile?.role?.toLowerCase();
      if (profileErr || (normalizedRole !== 'admin' && normalizedRole !== 'super_admin')) {
        await supabase.auth.signOut();
        setError('Access Denied: Master administrator privileges required.');
        setIsLoading(false);
        return;
      }

      // Admin role confirmed, redirecting to the administrative suite
      navigate('/admin');
    } catch (err: any) {
      console.error('Admin authentication error:', err);
      setError(err?.message || 'Failed to authenticate secure administrator channel.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div id="admin-signin-root" className="min-h-screen w-full flex items-center justify-center px-4 py-16 relative overflow-hidden bg-gradient-to-tr from-purple-100/80 via-fuchsia-50/60 to-indigo-100/80">
      {/* Heavy Quantum Field Ambient Glows */}
      <div className="absolute top-1/4 left-1/4 w-[600px] h-[600px] bg-gradient-to-tr from-purple-400/20 to-indigo-300/20 rounded-full blur-[140px] pointer-events-none"></div>
      <div className="absolute bottom-1/4 right-1/4 w-[600px] h-[600px] bg-fuchsia-400/10 rounded-full blur-[120px] pointer-events-none"></div>

      <div id="admin-signin-card" className="w-full max-w-4xl bg-white/70 backdrop-blur-2xl border border-white/60 rounded-[3rem] shadow-[0_40px_90px_rgba(147,51,234,0.12),inset_0_1px_2px_0_rgba(255,255,255,0.7)] p-12 md:p-20 relative overflow-hidden animate-slide-up">
        {/* Neon Laser Security Framing */}
        <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-purple-400/40 to-transparent"></div>
        <div className="absolute bottom-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-indigo-400/30 to-transparent"></div>

        <div className="relative z-10 flex flex-col items-center">
          <Link to="/" className="mb-4">
            <Logo className="scale-125 transition-all duration-300" />
          </Link>
          
          <div className="text-center mb-10">
            <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full border border-purple-500/25 bg-purple-50 text-brand-600 text-[10px] font-mono font-bold tracking-widest uppercase mb-3">
              <span className="w-1.5 h-1.5 rounded-full bg-brand-600 animate-pulse"></span>
              SECURE ADMIN GATEWAY
            </span>
            <h1 className="text-2xl md:text-3xl font-bold font-sans tracking-tight text-slate-900 mb-2">
              tym2muv Control Panel
            </h1>
            <p className="text-slate-600 text-xs md:text-sm max-w-md mx-auto font-medium">
              Please authenticate using authorized administrative credentials to access command consoles, moderation tools, and global listings.
            </p>
          </div>

          <form onSubmit={handleAdminSignIn} className="space-y-6 w-full">
            {error && (
              <div id="admin-auth-error" className="bg-red-500/10 border border-red-500/20 text-red-700 px-5 py-4 rounded-2xl text-sm font-mono animate-shake flex items-center gap-3">
                <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse flex-shrink-0"></span>
                <span>{error}</span>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Email Address */}
              <div className="flex flex-col gap-2">
                <label className="text-slate-500 text-xs font-mono font-bold tracking-wider uppercase ml-1">
                  SECURE_EMAIL_IDENTIFIER
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400">
                    <Icon name="mail" size={18} />
                  </div>
                  <input
                    id="admin-email-field"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="e.g. admin@tym2muv.com"
                    autoFocus
                    required
                    disabled={isLoading}
                    className="w-full pl-12 pr-4 py-4 bg-white/80 border border-purple-100 rounded-2xl text-slate-800 placeholder-slate-400 focus:outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-500/10 transition-all text-sm font-sans"
                  />
                </div>
              </div>

              {/* Password */}
              <div className="flex flex-col gap-2">
                <label className="text-slate-500 text-xs font-mono font-bold tracking-wider uppercase ml-1">
                  PASSCODE_KEY
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400">
                    <Icon name="lock" size={18} />
                  </div>
                  <input
                    id="admin-password-field"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••••••••"
                    required
                    disabled={isLoading}
                    className="w-full pl-12 pr-4 py-4 bg-white/80 border border-purple-100 rounded-2xl text-slate-800 placeholder-slate-400 focus:outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-500/10 transition-all text-sm font-sans"
                  />
                </div>
              </div>
            </div>

            {/* Authenticate Action */}
            <button
              id="admin-submit-btn"
              type="submit"
              disabled={isLoading}
              className="mt-8 w-full py-5 text-sm font-mono font-bold text-white rounded-2xl bg-gradient-to-r from-brand-600 to-indigo-600 hover:from-brand-500 hover:to-indigo-500 transition-all duration-300 shadow-[0_8px_30px_rgba(139,92,246,0.25)] hover:shadow-[0_12px_40px_rgba(139,92,246,0.35)] hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50 disabled:pointer-events-none flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                  <span>ESTABLISHING_SECURE_BRIDGE...</span>
                </>
              ) : (
                <>
                  <Icon name="shield" size={16} />
                  <span>DECRYPT_ADMINISTRATIVE_GATEWAY</span>
                </>
              )}
            </button>

            <div className="pt-6 text-center">
              <Link
                to="/signin"
                className="text-xs font-mono tracking-wider text-slate-500 hover:text-brand-600 transition-colors"
              >
                // Return to Public User Console
              </Link>
            </div>

            {/* Dev Sandbox Pre-fill */}
            <div className="mt-8 p-6 rounded-3xl border border-dashed border-purple-200/60 bg-purple-50/15 max-w-md mx-auto text-left space-y-3 font-sans select-none">
              <div className="flex items-center gap-2 text-purple-700 font-extrabold text-[11px] uppercase tracking-wider">
                <Icon name="sparkles" size={14} className="text-purple-500 animate-pulse" />
                <span>Developer Testing Sandbox</span>
              </div>
              <p className="text-slate-650 text-xs leading-normal font-medium">
                Click below to automatically prefill standard platform administrator credentials. Live backend auto-provisioning is built-in.
              </p>
              <button
                type="button"
                onClick={() => {
                  setEmail('admin@tym2muv.com');
                  setPassword('Password123!');
                }}
                className="w-full py-2.5 px-4 bg-white hover:bg-purple-600 hover:text-white border border-purple-200/50 text-[#7C3AED] rounded-xl text-xs font-bold font-mono transition-all duration-200 flex items-center justify-center gap-2 shadow-3xs cursor-pointer hover:shadow-2xs active:scale-[0.98]"
              >
                <Icon name="zap" size={13} className="fill-current animate-bounce" />
                <span>Inject Admin Credentials</span>
              </button>
              <div className="text-center text-[9px] font-mono text-slate-400">
                admin@tym2muv.com / Password123!
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default AdminLogin;
