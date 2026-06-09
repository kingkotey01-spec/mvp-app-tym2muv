import React, { createContext, useContext, useEffect, useState } from 'react';
import { User } from '../types';
import { getUserProfile, logout as backendLogout } from '../services/supabaseService';
import type { User as SupabaseUser } from '@supabase/supabase-js';
import { supabase } from '../supabaseClient';

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
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        try {
          if (event === 'INITIAL_SESSION' || event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
            const sUser = session?.user ?? null;
            setSupabaseUser(sUser);
            
            if (sUser) {
              setLoading(true);
              const profile = await getUserProfile(sUser.id).catch(() => null);
              const currentUserDoc = profile ? { ...profile, email: sUser.email } : buildFallbackUser(sUser);
              setUser(currentUserDoc as any);
              
              // Inject in-app welcome notification and simulated email trigger when the user signs up
              const welcomeSentKey = `tym2muv_welcome_sent_${sUser.id}`;
              if (!localStorage.getItem(welcomeSentKey)) {
                const cachedNotifsRaw = localStorage.getItem('tym2muv_notifications');
                let notifications = [];
                try {
                  notifications = cachedNotifsRaw ? JSON.parse(cachedNotifsRaw) : [];
                } catch (_) {
                  notifications = [];
                }

                const hasWelcomeNotification = notifications.some((n: any) => n.link === '#welcome-email');
                if (!hasWelcomeNotification) {
                  const welcomeNotif = {
                    id: Date.now(),
                    title: 'you’re in. welcome to tym2muv 🔑',
                    text: `Hey ${currentUserDoc.name || 'friend'}! Your account is active. Click here to preview your official welcome deliverable and login guide.`,
                    time: 'Just now',
                    read: false,
                    link: '#welcome-email'
                  };
                  localStorage.setItem('tym2muv_notifications', JSON.stringify([welcomeNotif, ...notifications]));
                  
                  // Track welcome email in a simulated outbox/deliveries store too
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
                  
                  // Dispatch custom events to update component states instantly
                  window.dispatchEvent(new Event('welcome_email_received'));
                  
                  // Auto-trigger a beautiful popup preview of the welcome email so the user gets real-time response feedback
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
          setSupabaseUser(null);
          setUser(null);
        } finally {
          setLoading(false);
          setIsAuthReady(true);
        }
      }
    );
    return () => subscription.unsubscribe();
  }, []);

  const isAuthenticated = !!supabaseUser;

  return (
    <AuthContext.Provider value={{ user, supabaseUser, loading, isAuthReady, isAuthenticated, logout, refreshUser }}>
      {children}
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
