import React from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { loginWithGoogle, loginWithLinkedIn, loginWithEmail, signupWithEmail, sendPasswordResetEmail } from '../services/supabaseService';
import { sendWelcomeComms } from '../services/notificationSimulator';
import Icon from '../components/Icon';
import { Logo } from '../components/Logo';

interface SignInProps {
  defaultTab?: 'signin' | 'signup';
}

const SignIn: React.FC<SignInProps> = ({ defaultTab }) => {
  const navigate = useNavigate();
  const location = useLocation();
  
  // Where to redirect after successful auth (set by ProtectedRoute or the Post button)
  const from: string = (location.state as any)?.from?.pathname || '/';
  const pendingVendor: boolean = !!(location.state as any)?.pendingVendor;

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
  const [showForgotPassword, setShowForgotPassword] = React.useState(false);
  const [forgotPasswordEmail, setForgotPasswordEmail] = React.useState('');

  const getPasswordStrength = (pass: string) => {
    if (!pass) return { score: 0, label: '', color: 'bg-slate-200', text: 'text-slate-400' };
    let score = 0;
    if (pass.length >= 6) score += 1;
    if (pass.length >= 8) score += 1;
    if (/[a-z]/.test(pass) && /[A-Z]/.test(pass)) score += 1;
    if (/\d/.test(pass) || /[^A-Za-z0-9]/.test(pass)) score += 1;

    switch (score) {
      case 1:
        return { score: 1, label: 'Weak', color: 'bg-red-500', text: 'text-red-500' };
      case 2:
        return { score: 2, label: 'Medium', color: 'bg-orange-450', text: 'text-orange-500' };
      case 3:
        return { score: 3, label: 'Strong', color: 'bg-yellow-500', text: 'text-yellow-600' };
      case 4:
        return { score: 4, label: 'Excellent', color: 'bg-green-500', text: 'text-green-600' };
      default:
        return { score: 0, label: 'Too short', color: 'bg-red-350', text: 'text-red-400' };
    }
  };

  React.useEffect(() => {
    setIsSignUp(defaultTab === 'signup' || location.pathname === '/signup');
    setShowForgotPassword(false);
    if (location.state?.role === 'Tenant') {
      setSelectedRole('Tenant');
    }
  }, [location.pathname, location.state, defaultTab]);

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
      
      const getPostAuthPath = (resultUser: any) => {
        if (isSignUp && selectedRole === 'Agent') {
          return '/create-vendor';
        }
        if (pendingVendor || from === '/post') {
          return '/signup';
        }
        
        const searchParams = new URLSearchParams(location.search);
        const queryRedirect = searchParams.get('redirect');
        if (queryRedirect) return queryRedirect;

        if (from && from !== '/' && from !== '/signin' && from !== '/signup') {
          return from;
        }

        return resultUser?.id ? `/profile/${resultUser.id}` : '/profile/me';
      };

      if (isSignUp) {
        const resultUser = await signupWithEmail(email, password, name, selectedRole);
        try {
          sendWelcomeComms(email, name, selectedRole);
        } catch (e) {
          console.error('Failed to trigger simulated welcome comms:', e);
        }
        setMessage('Registration successful! Secure profile provisioned.');
        setTimeout(() => {
          navigate(getPostAuthPath(resultUser), { replace: true });
        }, 1500);
      } else {
        const resultUser = await loginWithEmail(email, password, selectedRole);
        setMessage('Authentication successful! Welcome back.');
        setTimeout(() => {
          navigate(getPostAuthPath(resultUser), { replace: true });
        }, 1100);
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred during authentication.');
      setIsLoading(false);
    }
  };

  const handleForgotPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoading) return;
    setError(null);
    setMessage(null);

    if (!forgotPasswordEmail) {
      setError('Please provide a valid email address.');
      return;
    }

    try {
      setIsLoading(true);
      await sendPasswordResetEmail(forgotPasswordEmail);
      setMessage('A secure password reset link has been dispatched to your email address. Please check your inbox.');
    } catch (err: any) {
      setError(err.message || 'An error occurred while setting up password recovery.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleAuth = async () => {
    try {
      setIsLoading(true);
      setError(null);
      localStorage.setItem('oauth_selected_role', selectedRole);
      if (pendingVendor || selectedRole === 'Agent') {
        localStorage.setItem('oauth_pending_vendor', 'true');
      }
      if (from) {
        localStorage.setItem('oauth_redirect', from);
      }
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
      if (pendingVendor || selectedRole === 'Agent') {
        localStorage.setItem('oauth_pending_vendor', 'true');
      }
      if (from) {
        localStorage.setItem('oauth_redirect', from);
      }
      await loginWithLinkedIn();
    } catch (err: any) {
      setError(err.message || 'Failed to sign in with LinkedIn.');
      console.error(err);
      setIsLoading(false);
    }
  };

  return (
    <div id="signin-root-container" className="min-h-screen w-full flex items-center justify-center px-4 py-4 relative overflow-hidden bg-gradient-to-tr from-purple-100/80 via-fuchsia-50/60 to-indigo-100/80 animate-fade-in">
      {/* Heavy Quantum Field Ambient Glows */}
      <div className="absolute top-1/4 left-1/4 w-[250px] h-[250px] bg-gradient-to-tr from-purple-400/20 to-indigo-300/20 rounded-full blur-[80px] pointer-events-none"></div>
      <div className="absolute bottom-1/4 right-1/4 w-[250px] h-[250px] bg-fuchsia-400/10 rounded-full blur-[70px] pointer-events-none"></div>

      <div id="signin-container-card" className="w-full max-w-sm bg-white/75 backdrop-blur-xl border border-white/60 rounded-2xl shadow-[0_12px_40px_rgba(147,51,234,0.06),inset_0_1px_2px_0_rgba(255,255,255,0.7)] p-4 md:p-5 relative overflow-hidden">
        {/* Neon Laser Security Framing */}
        <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-purple-400/30 to-transparent"></div>
        <div className="absolute bottom-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-indigo-400/20 to-transparent"></div>

        <div className="relative z-10 flex flex-col items-center">
          <Link to="/" className="mb-1">
            <Logo className="scale-90 transition-all duration-300" />
          </Link>
          
          <div className="text-center mb-3">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border border-purple-500/10 bg-purple-50/50 text-brand-600 text-[8px] font-mono font-bold tracking-wider uppercase mb-1">
              <span className="w-1 h-1 rounded-full bg-brand-600 animate-pulse"></span>
              {showForgotPassword 
                ? 'SECURE RECOVERY'
                : isSignUp 
                  ? 'SECURE REGISTRATION' 
                  : 'SECURE AUTHENTICATION'
              }
            </span>
            <h1 className="text-base md:text-lg font-bold font-sans tracking-tight text-slate-900 leading-tight mb-0.5">
              {showForgotPassword
                ? 'Reset Your Password'
                : isSignUp 
                  ? 'Create Account' 
                  : 'Welcome to tym2muv'
              }
            </h1>
            <p className="text-slate-500 text-[10px] max-w-xs mx-auto leading-normal">
              {showForgotPassword
                ? 'Enter your verified email below for recovery.'
                : isSignUp 
                  ? 'Join our hyper-growth secure portal today.'
                  : 'Access your secure dashboard.'
              }
            </p>
          </div>

          <div className="space-y-2.5 w-full">
            {supabaseStatusError && (
              <div id="supabase-offline-warning" className="bg-amber-500/10 border border-amber-500/20 text-amber-900 p-4 rounded-2xl text-[11px] leading-relaxed shadow-sm">
                <div className="flex items-start gap-3">
                  <div className="p-1.5 bg-amber-500/20 text-amber-700 rounded-xl shrink-0">
                    <Icon name="alert" size={16} />
                  </div>
                  <div>
                    <h3 className="font-sans font-bold text-amber-950">Supabase Connection Guarded</h3>
                    <p className="text-xs text-slate-600">The server is unreachable. Please verify system credentials or wake up your instance.</p>
                  </div>
                </div>
              </div>
            )}

            {error && (
              <div id="auth-error-display" className="bg-red-500/10 border border-red-500/20 text-red-700 px-4 py-2.5 rounded-xl text-xs font-mono flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse"></span>
                <span>{error}</span>
              </div>
            )}
            
            {message && (
              <div id="auth-success-display" className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 px-4 py-2.5 rounded-xl text-xs font-mono flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                <span>{message}</span>
              </div>
            )}

            {/* Futuristic Role Switcher */}
            {!showForgotPassword && (
              <div className="grid grid-cols-2 p-0.5 bg-slate-950/5 rounded-xl border border-purple-100 shadow-inner">
                <button
                  id="role-tenant-btn"
                  type="button"
                  onClick={() => setSelectedRole('Tenant')}
                  className={`py-1.5 text-[9px] font-mono font-bold rounded-lg transition-all duration-300 ${
                    selectedRole === 'Tenant'
                      ? 'bg-gradient-to-r from-brand-600 to-indigo-600 text-white shadow-sm'
                      : 'text-slate-500 hover:text-slate-900'
                  }`}
                >
                  RENTER_BUYER
                </button>
                <button
                  id="role-agent-btn"
                  type="button"
                  onClick={() => setSelectedRole('Agent')}
                  className={`py-1.5 text-[9px] font-mono font-bold rounded-lg transition-all duration-300 ${
                    selectedRole === 'Agent'
                      ? 'bg-gradient-to-r from-brand-600 to-indigo-600 text-white shadow-sm'
                      : 'text-slate-500 hover:text-slate-900'
                  }`}
                >
                  AGENT_SELLER
                </button>
              </div>
            )}

            {showForgotPassword ? (
              /* Forgotten Password Form */
              <form onSubmit={handleForgotPasswordSubmit} className="space-y-2 w-full">
                <div className="space-y-0.5">
                  <label className="text-[10px] font-bold text-slate-700 tracking-wide block">Email Address</label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-slate-400">
                      <Icon name="mail" size={13} />
                    </span>
                    <input
                      type="email"
                      placeholder="email@example.com"
                      required
                      value={forgotPasswordEmail}
                      onChange={(e) => setForgotPasswordEmail(e.target.value)}
                      className="w-full pl-8 pr-2.5 py-1.5 bg-white/70 hover:bg-white border border-slate-200 focus:border-purple-500 rounded-lg text-[11px] focus:ring-2 focus:ring-purple-500/10 outline-none transition-all placeholder:text-slate-400 font-medium text-slate-800 shadow-sm"
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-1.5 pt-0.5">
                  <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full py-1.5 bg-gradient-to-r from-brand-600 to-indigo-600 hover:from-brand-700 hover:to-indigo-700 text-white font-bold rounded-lg shadow-sm hover:opacity-95 text-[11px] transition-all flex items-center justify-center gap-1 cursor-pointer font-sans"
                  >
                    {isLoading ? 'SENDING...' : 'Send Recovery Link'}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setShowForgotPassword(false);
                      setError(null);
                      setMessage(null);
                    }}
                    className="w-full py-1.5 bg-slate-50 border border-slate-200 hover:bg-slate-100 text-slate-650 font-bold rounded-lg text-[11px] transition-all flex items-center justify-center cursor-pointer font-sans"
                  >
                    Back to Sign In
                  </button>
                </div>
              </form>
            ) : (
              /* Credential Authentication form */
              <form onSubmit={handleCredentialAuth} className="space-y-2 w-full">
                {isSignUp && (
                  <div className="space-y-0.5">
                    <label className="text-[10px] font-bold text-slate-700 block">Full Name</label>
                    <div className="relative">
                      <span className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-slate-400">
                        <Icon name="user" size={13} />
                      </span>
                      <input
                        type="text"
                        placeholder="Jane Doe"
                        required
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="w-full pl-8 pr-2.5 py-1.5 bg-white/70 hover:bg-white border border-slate-200 focus:border-purple-500 rounded-lg text-[11px] focus:ring-2 focus:ring-purple-500/10 outline-none transition-all placeholder:text-slate-400 font-medium text-slate-800 shadow-sm"
                      />
                    </div>
                  </div>
                )}

                <div className="space-y-0.5">
                  <label className="text-[10px] font-bold text-slate-700 block">Email Address</label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-slate-400">
                      <Icon name="mail" size={13} />
                    </span>
                    <input
                      type="email"
                      placeholder="email@example.com"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full pl-8 pr-2.5 py-1.5 bg-white/70 hover:bg-white border border-slate-200 focus:border-purple-500 rounded-lg text-[11px] focus:ring-2 focus:ring-purple-500/10 outline-none transition-all placeholder:text-slate-400 font-medium text-slate-800 shadow-sm"
                    />
                  </div>
                </div>

                <div className="space-y-0.5">
                  <div className="flex justify-between items-center">
                    <label className="text-[10px] font-bold text-slate-700 block">Password</label>
                    {!isSignUp && (
                      <button
                        type="button"
                        onClick={() => {
                          setShowForgotPassword(true);
                          setError(null);
                          setMessage(null);
                        }}
                        className="text-[9px] font-bold text-purple-600 hover:text-purple-850 hover:underline transition-colors focus:outline-none cursor-pointer"
                      >
                        Forgot?
                      </button>
                    )}
                  </div>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-slate-400">
                      <Icon name="lock" size={13} />
                    </span>
                    <input
                      type="password"
                      placeholder="••••••••"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full pl-8 pr-2.5 py-1.5 bg-white/70 hover:bg-white border border-slate-200 focus:border-purple-500 rounded-lg text-[11px] focus:ring-2 focus:ring-purple-500/10 outline-none transition-all placeholder:text-slate-400 font-medium text-slate-800 shadow-sm"
                    />
                  </div>
                  {isSignUp && password && (
                    <div className="mt-1.5 space-y-1">
                      <div className="flex justify-between items-center">
                        <span className="text-[9px] font-bold text-slate-400">Password Strength:</span>
                        <span className={`text-[9.5px] font-black uppercase tracking-wider ${getPasswordStrength(password).text}`}>
                          {getPasswordStrength(password).label}
                        </span>
                      </div>
                      <div className="h-1 w-full bg-slate-100 rounded-full overflow-hidden flex gap-0.5">
                        <div className={`h-full flex-1 rounded-full ${getPasswordStrength(password).score >= 1 ? getPasswordStrength(password).color : 'bg-slate-200/50'}`} />
                        <div className={`h-full flex-1 rounded-full ${getPasswordStrength(password).score >= 2 ? getPasswordStrength(password).color : 'bg-slate-200/50'}`} />
                        <div className={`h-full flex-1 rounded-full ${getPasswordStrength(password).score >= 3 ? getPasswordStrength(password).color : 'bg-slate-200/50'}`} />
                        <div className={`h-full flex-1 rounded-full ${getPasswordStrength(password).score >= 4 ? getPasswordStrength(password).color : 'bg-slate-200/50'}`} />
                      </div>
                      <p className="text-[8px] text-slate-400 font-medium">Use 8+ characters with uppercase, lowercase, numbers & symbols.</p>
                    </div>
                  )}
                </div>

                {isSignUp && (
                  <div id="terms-checkbox-container" className="flex items-start gap-1.5 bg-purple-50/40 border border-purple-100/50 p-1.5 rounded-lg transition-all">
                    <input
                      id="signup-agree-checkbox"
                      type="checkbox"
                      checked={agreedToTerms}
                      onChange={(e) => setAgreedToTerms(e.target.checked)}
                      className="mt-0.5 h-3 w-3 rounded border-purple-200 text-purple-600 focus:ring-purple-500 hover:border-purple-400 accent-purple-600 cursor-pointer"
                    />
                    <label id="signup-agree-label" htmlFor="signup-agree-checkbox" className="text-[9px] text-slate-650 font-semibold cursor-pointer leading-tight select-none">
                      I accept the <Link to="/info/terms" className="text-purple-600 hover:underline font-bold" target="_blank">Terms</Link> & <Link to="/info/privacy" className="text-purple-600 hover:underline font-bold" target="_blank">Privacy</Link>.
                    </label>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isLoading || (isSignUp && !agreedToTerms)}
                  className="w-full py-1.5 bg-gradient-to-r from-brand-600 to-indigo-600 hover:from-brand-700 hover:to-indigo-700 text-white font-bold rounded-lg shadow-sm text-[11px] transition-all disabled:opacity-50 disabled:pointer-events-none flex items-center justify-center gap-1 cursor-pointer mt-1"
                >
                  {isLoading ? (
                    <span>PROCESSING...</span>
                  ) : (
                    <span>{isSignUp ? 'Create My Account' : 'Sign In Now'}</span>
                  )}
                </button>
              </form>
            )}

            {/* Separator */}
            {!showForgotPassword && (
              <>
                <div className="relative flex items-center justify-center my-1.5">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-slate-200"></div>
                  </div>
                  <span className="relative px-2 bg-white/70 backdrop-blur-md text-[8px] font-mono font-bold text-slate-400 tracking-wider uppercase">
                    SOCIAL GATES
                  </span>
                </div>

                {/* Compact Social Buttons */}
                <div className="flex flex-col items-center gap-1.5">
                  <div className="flex justify-center items-center gap-3 py-0.5">
                    {/* Google */}
                    <button
                      id="auth-google-btn"
                      type="button"
                      onClick={handleGoogleAuth}
                      disabled={isLoading || (isSignUp && !agreedToTerms)}
                      title={isSignUp ? 'Sign up with Google' : 'Sign in with Google'}
                      className="w-9 h-9 flex items-center justify-center bg-white border border-purple-100 hover:border-brand-500/30 rounded-xl transition-all shadow-sm hover:scale-105 active:scale-95 disabled:opacity-40 group"
                    >
                      <svg className="w-4.5 h-4.5 transition-transform group-hover:scale-105" viewBox="0 0 24 24">
                        <path fill="#EA4335" d="M12 5.04c1.62 0 3.08.56 4.22 1.66l3.15-3.15C17.43 1.74 14.93 1 12 1 7.22 1 3.19 3.73 1.25 7.73l3.8 2.95C5.97 7.15 8.73 5.04 12 5.04z" />
                        <path fill="#4285F4" d="M23.49 12.27c0-.82-.07-1.61-.21-2.38H12v4.51h6.44c-.28 1.48-1.12 2.73-2.38 3.58l3.7 2.87c2.16-2 3.43-4.94 3.43-8.58z" />
                        <path fill="#FBBC05" d="M5.05 14.68c-.24-.72-.38-1.49-.38-2.28s.14-1.56.38-2.28L1.25 7.17C.45 8.78 0 10.59 0 12.5s.45 3.72 1.25 5.33l3.8-3.15z" />
                        <path fill="#34A853" d="M12 23c3.24 0 5.95-1.08 7.93-2.91l-3.7-2.87c-1.03.69-2.34 1.1-4.23 1.1-3.27 0-6.03-2.11-7.02-5.18l-3.8 2.95C3.19 20.27 7.22 23 12 23z" />
                      </svg>
                    </button>

                    {/* LinkedIn */}
                    <button
                      id="auth-linkedin-btn"
                      type="button"
                      onClick={handleLinkedInAuth}
                      disabled={isLoading || (isSignUp && !agreedToTerms)}
                      title={isSignUp ? 'Sign up with LinkedIn' : 'Sign in with LinkedIn'}
                      className="w-9 h-9 flex items-center justify-center bg-[#0A66C2] hover:bg-[#004182] border border-transparent rounded-xl transition-all shadow-sm hover:scale-105 active:scale-95 disabled:opacity-40 group"
                    >
                      <svg className="w-4.5 h-4.5 fill-current text-white transition-transform group-hover:scale-105" viewBox="0 0 24 24">
                        <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z" />
                      </svg>
                    </button>
                  </div>

                  {isSignUp && !agreedToTerms && (
                    <p id="consent-warning-msg" className="text-center text-[8px] font-mono text-purple-650 font-bold tracking-wider animate-pulse">
                      ⚡ ACCEPT REGISTRATION TO LOG IN
                    </p>
                  )}
                </div>

                <div className="pt-1 text-center">
                  {isSignUp ? (
                    <Link
                      to="/signin"
                      className="text-[10px] font-black text-purple-600 hover:text-purple-800 transition-colors hover:underline"
                    >
                      Already have an account? Sign In
                    </Link>
                  ) : (
                    <Link
                      to="/signup"
                      className="text-[10px] font-black text-purple-600 hover:text-purple-800 transition-colors hover:underline"
                    >
                      Don't have an account? Sign Up
                    </Link>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SignIn;
