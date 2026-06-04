import React from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { loginWithGoogle, loginWithLinkedIn, loginWithEmail, signupWithEmail } from '../services/supabaseService';
import Icon from '../components/Icon';
import { Logo } from '../components/Logo';

interface SignInProps {
  defaultTab?: 'signin' | 'signup';
}

const SignIn: React.FC<SignInProps> = ({ defaultTab }) => {
  const navigate = useNavigate();
  const location = useLocation();

  const [error, setError] = React.useState<string | null>(null);
  const [message, setMessage] = React.useState<string | null>(null);
  const [supabaseStatusError, setSupabaseStatusError] = React.useState<string | null>(null);
  const [isLoading, setIsLoading] = React.useState(false);
  const [isSignUp, setIsSignUp] = React.useState(defaultTab === 'signup' || location.pathname === '/signup');
  const [selectedRole, setSelectedRole] = React.useState<'Tenant' | 'Agent'>('Tenant');
  const [agreedToTerms, setAgreedToTerms] = React.useState(false);

  // Email, Password, Name Forms
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [name, setName] = React.useState('');

  React.useEffect(() => {
    setIsSignUp(defaultTab === 'signup' || location.pathname === '/signup');
  }, [location.pathname, defaultTab]);

  React.useEffect(() => {
    const probeSupabase = async () => {
      const dbUrl = import.meta.env.VITE_SUPABASE_URL;
      if (!dbUrl || dbUrl.includes('placeholder') || dbUrl.includes('your-project')) {
        return;
      }
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 4000);
        
        await fetch(`${dbUrl}/auth/v1/health`, {
          signal: controller.signal,
          headers: { 'Accept': 'application/json' }
        });
        clearTimeout(timeoutId);
      } catch (err: any) {
        console.error("Supabase connection check failed:", err);
        setSupabaseStatusError(dbUrl);
      }
    };
    probeSupabase();
  }, []);

  const handleCredentialAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoading) return;
    setError(null);
    setMessage(null);

    if (isSignUp && !agreedToTerms) {
      setError('Please accept the Terms of Service and Privacy Policy to register.');
      return;
    }

    if (!email || !password || (isSignUp && !name)) {
      setError('Please fill in all required fields.');
      return;
    }

    try {
      setIsLoading(true);
      if (isSignUp) {
        await signupWithEmail(email, password, name, selectedRole);
        setMessage('Registration successful! Secure profile provisioned.');
        setTimeout(() => {
          navigate('/');
        }, 1500);
      } else {
        await loginWithEmail(email, password, selectedRole);
        setMessage('Authentication successful! Welcome back.');
        setTimeout(() => {
          navigate('/');
        }, 1500);
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred during authentication.');
      setIsLoading(false);
    }
  };

  const handleGoogleAuth = async () => {
    try {
      setIsLoading(true);
      setError(null);
      localStorage.setItem('oauth_selected_role', selectedRole);
      await loginWithGoogle();
    } catch (err: any) {
      setError(err.message || 'Failed to sign in with Google.');
      console.error(err);
      setIsLoading(false);
    }
  };

  const handleLinkedInAuth = async () => {
    try {
      setIsLoading(true);
      setError(null);
      localStorage.setItem('oauth_selected_role', selectedRole);
      await loginWithLinkedIn();
    } catch (err: any) {
      setError(err.message || 'Failed to sign in with LinkedIn.');
      console.error(err);
      setIsLoading(false);
    }
  };

  return (
    <div id="signin-root-container" className="min-h-screen w-full flex items-center justify-center px-4 py-16 relative overflow-hidden bg-gradient-to-tr from-purple-100/80 via-fuchsia-50/60 to-indigo-100/80">
      {/* Heavy Quantum Field Ambient Glows */}
      <div className="absolute top-1/4 left-1/4 w-[600px] h-[600px] bg-gradient-to-tr from-purple-400/20 to-indigo-300/20 rounded-full blur-[140px] pointer-events-none"></div>
      <div className="absolute bottom-1/4 right-1/4 w-[600px] h-[600px] bg-fuchsia-400/10 rounded-full blur-[120px] pointer-events-none"></div>

      <div id="signin-container-card" className="w-full max-w-4xl bg-white/70 backdrop-blur-2xl border border-white/60 rounded-[3rem] shadow-[0_40px_90px_rgba(147,51,234,0.12),inset_0_1px_2px_0_rgba(255,255,255,0.7)] p-12 md:p-20 relative overflow-hidden animate-slide-up">
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
              {isSignUp ? 'SECURE REGISTRATION GATEWAY' : 'SECURE AUTHENTICATION GATEWAY'}
            </span>
            <h1 className="text-2xl md:text-3xl font-bold font-sans tracking-tight text-slate-900 mb-2">
              {isSignUp ? 'Create CaliberDesk Account' : 'Welcome to CaliberDesk'}
            </h1>
            <p className="text-slate-600 text-xs md:text-sm max-w-md mx-auto font-medium">
              {isSignUp 
                ? 'Join our hyper-growth global workforce matching top-tier talent with world-class agents.'
                : 'Access your secure candidate dashboard, active jobs, and custom listings.'
              }
            </p>
          </div>

          <div className="space-y-8 w-full">
            {supabaseStatusError && (
              <div id="supabase-offline-warning" className="bg-amber-500/10 border-2 border-amber-500/30 text-amber-900 p-6 rounded-3xl text-sm leading-relaxed shadow-lg backdrop-blur-md relative overflow-hidden animate-pulse-subtle">
                <div className="absolute top-0 right-0 p-3 opacity-10">
                  <Icon name="alert" size={54} />
                </div>
                <div className="flex items-start gap-4">
                  <div className="p-2.5 bg-amber-500/20 text-amber-700 rounded-2xl shrink-0 mt-0.5">
                    <Icon name="alert" size={24} />
                  </div>
                  <div className="space-y-3">
                    <h3 className="font-sans font-bold text-base text-amber-950 tracking-tight">
                      Supabase Backend Offline or Paused
                    </h3>
                    <p className="text-slate-700 text-xs">
                      We detected that your configured Supabase host <code className="bg-amber-100/50 px-1.5 py-0.5 rounded font-mono text-xs font-bold break-all">{supabaseStatusError.replace('https://', '')}</code> is unreachable (IP address not found).
                    </p>
                    <div className="bg-white/80 rounded-2xl p-4 border border-amber-200/50 space-y-2">
                      <p className="text-[10px] font-bold text-slate-800 uppercase tracking-wider">How to unpause/restore your database:</p>
                      <ul className="list-disc pl-4 text-xs text-slate-600 space-y-1.5 font-medium">
                        <li>
                          <strong className="text-slate-800">Restore Project:</strong> Supabase pauses inactive free-tier projects automatically. Log in to your <a href="https://supabase.com/dashboard" target="_blank" rel="noopener noreferrer" className="text-brand-650 underline font-bold hover:text-brand-800">Supabase Dashboard</a>, find your project <code className="bg-slate-100 px-1 py-0.5 rounded font-mono">{supabaseStatusError.replace('https://', '').split('.')[0]}</code>, and hit <strong className="text-brand-600">"Restore Project"</strong>.
                        </li>
                        <li>
                          <strong className="text-slate-800">Check Variable configuration:</strong> Ensure your settings in the left sidebar of AI Studio have the exact spelling for <code className="bg-slate-100 px-1 py-0.5 rounded font-mono font-bold">VITE_SUPABASE_URL</code> and <code className="bg-slate-100 px-1 py-0.5 rounded font-mono font-bold">VITE_SUPABASE_ANON_KEY</code>.
                        </li>
                        <li>
                          After unpausing, wait about 1-2 minutes for the database to boot, then <button onClick={() => window.location.reload()} className="text-brand-600 underline font-bold hover:text-brand-800 cursor-pointer">refresh this page</button> to register/login!
                        </li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {error && (
              <div id="auth-error-display" className="bg-red-500/10 border border-red-500/20 text-red-700 px-5 py-4 rounded-2xl text-sm font-mono animate-shake flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span>
                <span>{error}</span>
              </div>
            )}
            
            {message && (
              <div id="auth-success-display" className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 px-5 py-4 rounded-2xl text-sm font-mono flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                <span>{message}</span>
              </div>
            )}

            {/* Futuristic Role Switcher */}
            <div className="grid grid-cols-2 p-2 bg-slate-950/5 rounded-3xl border border-purple-100 shadow-inner">
              <button
                id="role-tenant-btn"
                type="button"
                onClick={() => setSelectedRole('Tenant')}
                className={`py-5 text-sm font-mono font-bold rounded-2xl transition-all duration-350 relative overflow-hidden ${
                  selectedRole === 'Tenant'
                    ? 'bg-gradient-to-r from-brand-600 to-indigo-600 text-white shadow-[0_6px_16px_rgba(139,92,246,0.25)] border border-white/10'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white/40'
                }`}
              >
                RENTER_BUYER
              </button>
              <button
                id="role-agent-btn"
                type="button"
                onClick={() => setSelectedRole('Agent')}
                className={`py-5 text-sm font-mono font-bold rounded-2xl transition-all duration-350 relative overflow-hidden ${
                  selectedRole === 'Agent'
                    ? 'bg-gradient-to-r from-brand-600 to-indigo-600 text-white shadow-[0_6px_16px_rgba(139,92,246,0.25)] border border-white/10'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white/40'
                }`}
              >
                AGENT_SELLER
              </button>
            </div>

            {/* Credential Authentication form */}
            <form onSubmit={handleCredentialAuth} className="space-y-5">
              {isSignUp && (
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700 tracking-wide block">Full Name</label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400">
                      <Icon name="user" size={18} />
                    </span>
                    <input
                      type="text"
                      placeholder="Jane Doe"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full pl-11 pr-4 py-4 bg-white/70 hover:bg-white border border-slate-200 focus:border-purple-500 rounded-2xl text-sm focus:ring-4 focus:ring-purple-500/10 outline-none transition-all placeholder:text-slate-400 font-medium text-slate-800 shadow-sm"
                    />
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-700 tracking-wide block">Email Address</label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400">
                    <Icon name="mail" size={18} />
                  </span>
                  <input
                    type="email"
                    placeholder="email@example.com"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-11 pr-4 py-4 bg-white/70 hover:bg-white border border-slate-200 focus:border-purple-500 rounded-2xl text-sm focus:ring-4 focus:ring-purple-500/10 outline-none transition-all placeholder:text-slate-400 font-medium text-slate-800 shadow-sm"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-700 tracking-wide block">Password</label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400">
                    <Icon name="lock" size={18} />
                  </span>
                  <input
                    type="password"
                    placeholder="••••••••"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-11 pr-4 py-4 bg-white/70 hover:bg-white border border-slate-200 focus:border-purple-500 rounded-2xl text-sm focus:ring-4 focus:ring-purple-500/10 outline-none transition-all placeholder:text-slate-400 font-medium text-slate-800 shadow-sm"
                  />
                </div>
              </div>

              {isSignUp && (
                <div id="terms-checkbox-container" className="flex items-start gap-4 bg-purple-50/40 border border-purple-100/50 p-4 rounded-2xl animate-fade-in transition-all">
                  <input
                    id="signup-agree-checkbox"
                    type="checkbox"
                    checked={agreedToTerms}
                    onChange={(e) => setAgreedToTerms(e.target.checked)}
                    className="mt-1 h-4 w-4 rounded border-purple-200 text-purple-600 focus:ring-purple-500 hover:border-purple-400 accent-purple-600 cursor-pointer"
                  />
                  <label id="signup-agree-label" htmlFor="signup-agree-checkbox" className="text-xs text-slate-700 font-semibold cursor-pointer leading-relaxed select-none">
                    I consent to CaliberDesk's secure profile registration and agree to the <Link to="/info/terms" className="text-purple-600 hover:underline font-bold" target="_blank">Terms of Service</Link> and <Link to="/info/privacy" className="text-purple-600 hover:underline font-bold" target="_blank">Privacy Policy</Link>.
                  </label>
                </div>
              )}

              <button
                type="submit"
                disabled={isLoading || (isSignUp && !agreedToTerms)}
                className="w-full py-4 bg-gradient-to-r from-brand-600 to-indigo-600 hover:from-brand-700 hover:to-indigo-700 text-white font-bold rounded-2xl shadow-lg shadow-brand-500/20 active:scale-[0.98] lg:active:scale-[0.99] transition-all disabled:opacity-50 disabled:pointer-events-none flex items-center justify-center gap-2 cursor-pointer"
              >
                {isLoading ? (
                  <>
                    <svg className="animate-spin h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    <span>{isSignUp ? 'CREATING SECURE PROFILE...' : 'AUTHENTICATING LOGINS...'}</span>
                  </>
                ) : (
                  <span>{isSignUp ? 'Sign Up with Email / Password' : 'Sign In with Email / Password'}</span>
                )}
              </button>
            </form>

            {/* Separator */}
            <div className="relative flex items-center justify-center my-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-200"></div>
              </div>
              <span className="relative px-4 bg-white/70 backdrop-blur-md text-[10px] font-mono font-bold text-slate-400 tracking-widest uppercase">
                SECURE SOCIAL INTERFACE
              </span>
            </div>

            {/* Futuristic Larger Social Authentication Buttons with logos only */}
            <div className="flex flex-col items-center gap-4">
              <div className="flex justify-center items-center gap-8 pt-2 pb-2">
                {/* Google Authentication Port */}
                <button
                  id="auth-google-btn"
                  type="button"
                  onClick={handleGoogleAuth}
                  disabled={isLoading || (isSignUp && !agreedToTerms)}
                  title={isSignUp ? 'Sign up with Google (Requires Consent)' : 'Sign in with Google'}
                  className="w-20 h-20 md:w-24 md:h-24 flex items-center justify-center bg-white border border-purple-100 hover:border-brand-500/40 rounded-[2rem] transition-all duration-300 shadow-[0_10px_40px_rgba(147,51,234,0.08)] hover:shadow-[0_16px_50px_rgba(147,51,234,0.18)] hover:scale-105 active:scale-95 disabled:opacity-40 disabled:hover:scale-100 disabled:shadow-none group"
                >
                  <svg className="w-10 h-10 md:w-12 md:h-12 transition-transform duration-300 group-hover:scale-110 group-disabled:scale-100" viewBox="0 0 24 24">
                    <path fill="#EA4335" d="M12 5.04c1.62 0 3.08.56 4.22 1.66l3.15-3.15C17.43 1.74 14.93 1 12 1 7.22 1 3.19 3.73 1.25 7.73l3.8 2.95C5.97 7.15 8.73 5.04 12 5.04z" />
                    <path fill="#4285F4" d="M23.49 12.27c0-.82-.07-1.61-.21-2.38H12v4.51h6.44c-.28 1.48-1.12 2.73-2.38 3.58l3.7 2.87c2.16-2 3.43-4.94 3.43-8.58z" />
                    <path fill="#FBBC05" d="M5.05 14.68c-.24-.72-.38-1.49-.38-2.28s.14-1.56.38-2.28L1.25 7.17C.45 8.78 0 10.59 0 12.5s.45 3.72 1.25 5.33l3.8-3.15z" />
                    <path fill="#34A853" d="M12 23c3.24 0 5.95-1.08 7.93-2.91l-3.7-2.87c-1.03.69-2.34 1.1-4.23 1.1-3.27 0-6.03-2.11-7.02-5.18l-3.8 2.95C3.19 20.27 7.22 23 12 23z" />
                  </svg>
                </button>

                {/* LinkedIn Authentication Port */}
                <button
                  id="auth-linkedin-btn"
                  type="button"
                  onClick={handleLinkedInAuth}
                  disabled={isLoading || (isSignUp && !agreedToTerms)}
                  title={isSignUp ? 'Sign up with LinkedIn (Requires Consent)' : 'Sign in with LinkedIn'}
                  className="w-20 h-20 md:w-24 md:h-24 flex items-center justify-center bg-[#0A66C2] hover:bg-[#004182] border border-transparent rounded-[2rem] transition-all duration-300 shadow-[0_10px_40px_rgba(10,102,194,0.22)] hover:shadow-[0_16px_50px_rgba(10,102,194,0.35)] hover:scale-105 active:scale-95 disabled:opacity-40 disabled:hover:scale-100 disabled:shadow-none group"
                >
                  <svg className="w-10 h-10 md:w-12 md:h-12 fill-current text-white transition-transform duration-300 group-hover:scale-110 group-disabled:scale-100" viewBox="0 0 24 24">
                    <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z" />
                  </svg>
                </button>
              </div>

              {isSignUp && !agreedToTerms && (
                <p id="consent-warning-msg" className="text-center text-[10px] font-mono text-purple-650 font-bold tracking-wider animate-pulse mt-1">
                  ⚡ PLEASE ACCEPT REGISTRATION CONSENT TO OPEN GATEWAY
                </p>
              )}
            </div>

            <div className="pt-6 text-center">
              {isSignUp ? (
                <Link
                  to="/signin"
                  className="text-base md:text-lg font-black text-purple-600 hover:text-purple-800 transition-colors hover:underline"
                >
                  Already have an account? Sign In
                </Link>
              ) : (
                <Link
                  to="/signup"
                  className="text-base md:text-lg font-black text-purple-600 hover:text-purple-800 transition-colors hover:underline"
                >
                  Don't have an account? Sign Up
                </Link>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SignIn;
