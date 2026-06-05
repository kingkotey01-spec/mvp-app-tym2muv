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
              const profile = await getUserProfile(sUser.id).catch(() => null);
              if (profile) {
                setUser({ ...profile, email: sUser.email } as any);
              } else {
                setUser(buildFallbackUser(sUser));
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
