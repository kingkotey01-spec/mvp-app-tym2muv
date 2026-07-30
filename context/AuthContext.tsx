import React, { createContext, useContext, useEffect, useState } from 'react';
import { User } from '../types';
import { getUserProfile, logout as backendLogout, createNotification } from '../services/supabaseService';
import type { User as SupabaseUser } from '@supabase/supabase-js';
import { supabase, isSupabaseConfigured } from '../supabaseClient';
import Icon from '../components/Icon';

interface AuthContextType {
  user: User | null;
  supabaseUser: SupabaseUser | null;
  loading: boolean;
  isAuthReady: boolean;
  isAuthenticated: boolean;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [supabaseUser, setSupabaseUser] = useState<SupabaseUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAuthReady, setIsAuthReady] = useState(false);

  const logout = async () => {
    await backendLogout();
  };

  const refreshUser = async () => {
    if (supabaseUser) {
      try {
        const profile = await getUserProfile(supabaseUser.id);
        if (profile) {
          setUser({ ...profile, email: supabaseUser.email } as any);
        } else {
          const fullName = supabaseUser.user_metadata?.full_name || supabaseUser.user_metadata?.name || supabaseUser.email?.split('@')[0] || 'User';
          const avatarUrl = supabaseUser.user_metadata?.avatar_url || supabaseUser.user_metadata?.picture || `https://ui-avatars.com/api/?name=${encodeURIComponent(fullName)}&background=random`;
          const rawRole = supabaseUser.user_metadata?.role || localStorage.getItem('oauth_selected_role') || 'Tenant';
          const formattedRole = rawRole.charAt(0).toUpperCase() + rawRole.slice(1).toLowerCase();
          
          setUser({
            id: supabaseUser.id,
            name: fullName,
            avatar: avatarUrl,
            email: supabaseUser.email,
            role: formattedRole as any,
            rating: 0,
            reviewCount: 0,
            location: 'Unknown',
            memberSince: supabaseUser.created_at || new Date().toISOString(),
            bio: '',
            verified: false,
            savedListings: [],
            socials: {}
          } as any);
        }
      } catch (err) {
        console.warn('Failed to refresh user profile, keeping old state or fallback:', err);
      }
    }
  };

  const buildFallbackUser = (sUser: SupabaseUser): User => {
    const fullName = sUser.user_metadata?.full_name || sUser.user_metadata?.name || sUser.email?.split('@')[0] || 'User';
    const avatarUrl = sUser.user_metadata?.avatar_url || sUser.user_metadata?.picture || `https://ui-avatars.com/api/?name=${encodeURIComponent(fullName)}&background=random`;
    const rawRole = sUser.user_metadata?.role || localStorage.getItem('oauth_selected_role') || 'Tenant';
    const formattedRole = rawRole.charAt(0).toUpperCase() + rawRole.slice(1).toLowerCase();

    return {
      id: sUser.id,
      name: fullName,
      avatar: avatarUrl,
      email: sUser.email,
      role: formattedRole as any,
      rating: 0,
      reviewCount: 0,
      location: 'Unknown',
      memberSince: sUser.created_at || new Date().toISOString(),
      bio: '',
      verified: false,
      savedListings: [],
      socials: {}
    } as any;
  };

  useEffect(() => {
    let isMounted = true;

    if (!isSupabaseConfigured) {
      setIsAuthReady(true);
      setLoading(false);
      return;
    }

    // Safety timeout: if onAuthStateChange doesn't resolve within 1000ms, mark auth as ready
    const timer = setTimeout(() => {
      if (isMounted) {
        setIsAuthReady(true);
        setLoading(false);
      }
    }, 1000);

    let subscription: { unsubscribe: () => void } | null = null;

    try {
      const authRes = supabase.auth.onAuthStateChange(
        async (event, session) => {
          clearTimeout(timer);
          if (!isMounted) return;

          try {
            if (event === 'INITIAL_SESSION' || event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
              const sUser = session?.user ?? null;
              setSupabaseUser(sUser);
              
              if (sUser) {
                setLoading(true);
                const profile = await getUserProfile(sUser.id).catch(() => null);
                if (isMounted) {
                  const currentUserDoc = profile ? { ...profile, email: sUser.email } : buildFallbackUser(sUser);
                  setUser(currentUserDoc as any);
                  
                  // Inject in-app welcome notification
                  const welcomeSentKey = `tym2muv_welcome_sent_${sUser.id}`;
                  if (!localStorage.getItem(welcomeSentKey)) {
                    await createNotification(
                      sUser.id,
                      'you’re in. welcome to tym2muv 🔑',
                      `Hey ${currentUserDoc.name || 'friend'}! Your account is active. Click here to preview your official welcome deliverable and login guide.`,
                      '#welcome-email'
                    ).catch((e) => console.error("Could not write welcome notification to Supabase:", e));
                      
                      const emailDelivery = {
                        id: Date.now().toString(),
                        toEmail: sUser.email || 'friend@tym2muv.com',
                        toName: currentUserDoc.name || 'friend',
                        subject: 'you’re in. welcome to tym2muv 🔑',
                        sentAt: new Date().toISOString()
                      };
                      const cachedDeliveriesRaw = localStorage.getItem('tym2muv_sent_emails');
                      let deliveries = [];
                      try {
                        deliveries = cachedDeliveriesRaw ? JSON.parse(cachedDeliveriesRaw) : [];
                      } catch (_) {}
                      localStorage.setItem('tym2muv_sent_emails', JSON.stringify([emailDelivery, ...deliveries]));

                      localStorage.setItem(welcomeSentKey, 'true');
                      window.dispatchEvent(new Event('welcome_email_received'));
                      setTimeout(() => {
                        window.dispatchEvent(new Event('open_welcome_email'));
                      }, 1200);
                  }
                }
              } else {
                setUser(null);
              }
            } else if (event === 'SIGNED_OUT') {
              setSupabaseUser(null);
              setUser(null);
            }
          } catch (error) {
            console.error('Error handling auth state change:', error);
            if (isMounted) {
              setSupabaseUser(null);
              setUser(null);
            }
          } finally {
            if (isMounted) {
              setLoading(false);
              setIsAuthReady(true);
            }
          }
        }
      );
      subscription = authRes.data.subscription;
    } catch (err) {
      console.warn("Failed to subscribe to auth state changes:", err);
      if (isMounted) {
        setIsAuthReady(true);
        setLoading(false);
      }
    }

    return () => {
      isMounted = false;
      clearTimeout(timer);
      if (subscription) subscription.unsubscribe();
    };
  }, []);

  const isAuthenticated = !!supabaseUser;

  const [showWarning, setShowWarning] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState(300);

  useEffect(() => {
    if (!supabaseUser) {
      setShowWarning(false);
      return;
    }

    const checkExpiration = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session && session.expires_at) {
          const expiresAt = session.expires_at;
          const timeLeftSeconds = expiresAt - Math.floor(Date.now() / 1000);
          
          if (timeLeftSeconds > 0 && timeLeftSeconds <= 300) {
            setTimeRemaining(timeLeftSeconds);
            setShowWarning(true);
          } else {
            setShowWarning(false);
          }
        }
      } catch (err) {
        console.error('Error checking token expiration:', err);
      }
    };

    checkExpiration();
    const interval = setInterval(checkExpiration, 10000);
    return () => clearInterval(interval);
  }, [supabaseUser]);

  const handleKeepSessionAlive = async () => {
    try {
      const { error } = await supabase.auth.refreshSession();
      if (error) {
        console.error('Failed to manually refresh session:', error);
      } else {
        setShowWarning(false);
      }
    } catch (err) {
      console.error('Failed to keep session alive:', err);
    }
  };

  useEffect(() => {
    if (!showWarning) return;

    const handleKeyDown = async (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowWarning(false);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        await handleKeepSessionAlive();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showWarning]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <AuthContext.Provider value={{ user, supabaseUser, loading, isAuthReady, isAuthenticated, logout, refreshUser }}>
      {children}
      {showWarning && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md">
          <div className="bg-white max-w-sm w-full rounded-2xl p-6 text-center shadow-2xl border border-slate-100 relative animate-fade-in animate-duration-300">
            <button 
              onClick={() => setShowWarning(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
              title="Close"
            >
              <Icon name="x" size={18} />
            </button>
            <div className="w-16 h-16 bg-amber-50 text-amber-500 rounded-full flex items-center justify-center mx-auto mb-4">
              <Icon name="clock" size={32} />
            </div>
            <h2 className="text-lg font-black text-slate-900 mb-1 leading-tight font-display">
              Session Securing
            </h2>
            <p className="text-[9px] text-amber-600 font-extrabold uppercase tracking-widest font-mono mb-4">
              Security Notice
            </p>
            <p className="text-xs text-slate-500 mb-6 leading-relaxed">
              For your safety, your active session will expire in <span className="font-bold text-slate-800 font-mono text-sm">{formatTime(timeRemaining)}</span>. Would you like to keep your session alive?
            </p>
            <div className="flex gap-2.5">
              <button 
                onClick={logout}
                className="flex-1 py-2.5 text-xs font-bold text-slate-500 hover:bg-slate-50 rounded-xl transition-colors border border-slate-200 cursor-pointer"
              >
                Log Out
              </button>
              <button 
                onClick={handleKeepSessionAlive}
                className="flex-1 py-2.5 text-xs font-bold bg-brand-600 hover:bg-brand-700 text-white rounded-xl transition-colors shadow-md shadow-brand-600/15 cursor-pointer"
              >
                Keep Alive
              </button>
            </div>
          </div>
        </div>
      )}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
