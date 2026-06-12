import { supabase } from '../supabaseClient';
import { Listing, User, UserRole, Chat, ChatMessage, SearchFilters, Monetization, Review, Payment, ViewRequest, StaticPage, BlogPost, RentFinancingApplication } from '../types';
import { withCache, delCache, invalidateCachePrefix, CACHE_TTL, cacheKey } from './cacheService';
import { uploadImageToSupabase } from './imageService';
import { MOCK_LISTINGS, MOCK_USERS, MOCK_ADS, MOCK_CHATS } from './mockData';

// --- AUTH SERVICES ---
export const loginWithEmail = async (email: string, password: string, selectedRole: 'Tenant' | 'Agent' | 'Admin' = 'Tenant'): Promise<any> => {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  
  // Fetch the actual DB role — don't trust the UI selection for sign-in
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', data.user!.id)
    .maybeSingle();

  const actualRole = profile?.role || selectedRole.toLowerCase();
  return Object.assign(data.user || {}, { 
    isNewAccount: false, 
    role: actualRole.charAt(0).toUpperCase() + actualRole.slice(1), 
    id: data.user?.id, 
    uid: data.user?.id 
  });
};

export const signupWithEmail = async (email: string, password: string, name: string, selectedRole: 'Tenant' | 'Agent' | 'Admin' = 'Tenant'): Promise<any> => {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: name,
        role: selectedRole.toLowerCase(),
      }
    }
  });
  if (error) throw error;
  
  return Object.assign(data.user || {}, { isNewAccount: true, role: selectedRole, id: data.user?.id, uid: data.user?.id });
};

export const logout = async () => {
  await supabase.auth.signOut();
};

export const subscribeToAuth = (callback: (user: any | null) => void) => {
  const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
    callback(session?.user || null);
  });

  return () => {
    subscription.unsubscribe();
  };
};

export const sendPasswordResetEmail = async (email: string) => {
  const redirectTo = `${window.location.origin}/reset-password`;
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo,
  });
  if (error) throw error;
};

export const verifyPasswordResetCode = async (_code: string): Promise<string> => {
  // Supabase handles reset via session tokens, not oobCode.
  // This path should not be reached in normal flow.
  throw new Error('Please use the reset link from your email to access this page.');
};

export const confirmPasswordReset = async (code: string, newPassword: string) => {
  await supabase.auth.updateUser({ password: newPassword });
};

export const loginWithGoogle = async () => {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: `${window.location.origin}/` }
  });
  if (error) throw error;
};

export const loginWithLinkedIn = async () => {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'linkedin_oidc',
    options: { redirectTo: `${window.location.origin}/` }
  });
  if (error) throw error;
};

// --- USER SERVICES ---
const getLocalReviewsForVendor = (vendorId: string): Review[] => {
  try {
    const raw = localStorage.getItem(`local_reviews_${vendorId}`);
    return raw ? JSON.parse(raw) : [];
  } catch (err) {
    console.error("Failed to parse local reviews:", err);
    return [];
  }
};

const saveLocalReviewForVendor = (vendorId: string, review: Review) => {
  try {
    const current = getLocalReviewsForVendor(vendorId);
    const updated = [review, ...current.filter(r => r.id !== review.id)];
    localStorage.setItem(`local_reviews_${vendorId}`, JSON.stringify(updated));
  } catch (err) {
    console.error("Failed to save local review:", err);
  }
};

const mapProfileToUser = (profileData: any): User => {
  let mappedRole: UserRole = 'Customer';
  if (profileData.role) {
    const r = String(profileData.role).toLowerCase();
    if (r === 'tenant') mappedRole = 'Tenant';
    else if (r === 'agent') mappedRole = 'Agent';
    else if (r === 'admin') mappedRole = 'Admin';
    else if (r === 'customer') mappedRole = 'Customer';
    else mappedRole = profileData.role;
  }

  // Calculate dynamic average rating and review count from both DB and local-submissions
  let rating = profileData.rating || 0;
  let reviewCount = profileData.review_count || 0;

  try {
    const local = getLocalReviewsForVendor(profileData.id);
    if (local.length > 0) {
      reviewCount = Math.max(reviewCount, local.length);
      const total = local.reduce((sum, r) => sum + Number(r.rating), 0);
      rating = Number((total / local.length).toFixed(1));
    }
  } catch (e) {
    console.error("Error aggregating dynamic local reviews for user profile:", e);
  }

  return {
    id: profileData.id,
    name: profileData.full_name || 'Unknown',
    avatar: profileData.avatar_url || 'https://ui-avatars.com/api/?name=Unknown&background=random',
    rating: rating,
    reviewCount: reviewCount,
    location: profileData.location || profileData.socials?.location || 'Unknown',
    memberSince: profileData.created_at || new Date().toISOString(),
    bio: profileData.bio || profileData.socials?.bio || '',
    verified: profileData.verified || false,
    role: mappedRole,
    savedListings: profileData.savedListings || [],
    email: profileData.email || '',
    socials: profileData.socials || {},
    agencyName: profileData.agency_name || profileData.socials?.agencyName || profileData.socials?.agency_name || undefined,
    licenseNumber: profileData.license_number || profileData.socials?.licenseNumber || profileData.socials?.license_number || undefined,
    specialization: profileData.specialization || profileData.socials?.specialization || profileData.socials?.specializations || []
  };
};

export const getUserProfile = async (userId: string): Promise<User | null> => {
  try {
    return await withCache(cacheKey('profile', userId), async () => {
      let { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();
        
      if (!data) {
        console.log("No profile found for authenticated user in database. Initiating dynamic client-side profile creation.");
        const { data: { user: authUser } } = await supabase.auth.getUser();
        if (authUser && authUser.id === userId) {
          const fullName = authUser.user_metadata?.full_name || authUser.user_metadata?.name || authUser.email?.split('@')[0] || 'Unknown';
          const avatarUrl = authUser.user_metadata?.avatar_url || authUser.user_metadata?.picture || `https://ui-avatars.com/api/?name=${encodeURIComponent(fullName)}&background=random`;
          
          const storedRole = localStorage.getItem('oauth_selected_role') || 'Tenant';
          const rawRole = (authUser.user_metadata?.role || storedRole).toLowerCase();

          // Standard database roles configurations we might need to match
          const rolesToTry = [rawRole, 'tenant', 'user', 'agent'];
          let insertSuccess = false;
          let insertError: any = null;

          for (const roleValue of rolesToTry) {
            try {
              const newProfile = {
                id: userId,
                full_name: fullName,
                avatar_url: avatarUrl,
                role: roleValue as any
              };

              const insertResult = await supabase
                .from('profiles')
                .insert(newProfile)
                .select('*')
                .maybeSingle();

              if (!insertResult.error && insertResult.data) {
                data = insertResult.data;
                insertSuccess = true;
                console.log(`Successfully auto-created missing user profile with role: ${roleValue}`);
                break;
              } else if (insertResult.error) {
                insertError = insertResult.error;
              }
            } catch (err) {
              insertError = err;
            }
          }

          if (!insertSuccess) {
            console.log("Fallback insertion by leaving the role column completely database-default.");
            try {
              const insertResult = await supabase
                .from('profiles')
                .insert({
                  id: userId,
                  full_name: fullName,
                  avatar_url: avatarUrl
                })
                .select('*')
                .maybeSingle();

              if (!insertResult.error && insertResult.data) {
                data = insertResult.data;
                insertSuccess = true;
                console.log("Successfully auto-created user profile with database default role.");
              } else {
                insertError = insertResult.error || insertError;
              }
            } catch (err) {
              insertError = err;
            }
          }

          if (insertSuccess && data) {
            // If the role is agent / Agent, make sure to try inserting into the 'agents' table if present in their schema
            if (data.role === 'agent' || data.role === 'Agent') {
              try {
                await supabase.from('agents').insert({ id: userId, company_name: '' });
              } catch (_) {
                // Table might not exist or already present, safe to ignore
              }
            }
          } else {
            console.error("Failed to auto-create user profile on-the-fly dynamically:", insertError);
          }
        }
      }
        
      if (!data) return null;
      
      const savedQuery = await supabase.from('saved_properties').select('property_id').eq('tenant_id', userId);
      data.savedListings = (savedQuery.data || []).map(r => r.property_id);

      return mapProfileToUser(data);
    }, CACHE_TTL.PROFILES);
  } catch (err) {
    console.error("Supabase profile fetch failed, falling back to mock users:", err);
    const mockUser = MOCK_USERS.find(u => u.id === userId);
    return (mockUser || null) as any;
  }
};

export const updateUserProfile = async (userId: string, updates: Partial<User>) => {
  const dbUpdates: any = {};
  if (updates.name !== undefined) dbUpdates.full_name = updates.name;
  if (updates.avatar !== undefined) dbUpdates.avatar_url = updates.avatar;
  if (updates.location !== undefined) dbUpdates.location = updates.location;
  if (updates.bio !== undefined) dbUpdates.bio = updates.bio;
  if (updates.socials !== undefined) dbUpdates.socials = updates.socials;
  if ((updates as any).agencyName !== undefined) dbUpdates.agency_name = (updates as any).agencyName;
  if ((updates as any).licenseNumber !== undefined) dbUpdates.license_number = (updates as any).licenseNumber;
  
  if (Object.keys(dbUpdates).length > 0) {
    try {
      const { error } = await supabase.from('profiles').update(dbUpdates).eq('id', userId);
      if (error) throw error;
    } catch (err: any) {
      const isMissingColumnError = err.code === '42703' || 
                                   String(err.message || '').includes('agency_name') || 
                                   String(err.message || '').includes('bio') || 
                                   String(err.message || '').includes('location') || 
                                   String(err.message || '').includes('license_number') || 
                                   String(err.message || '').includes('column') || 
                                   String(err.message || '').includes('schema cache');
                                   
      if (isMissingColumnError) {
        console.warn("Retrying profile update by falling back missing columns ('agency_name', 'bio', 'location', or 'license_number') to 'socials' JSON attribute due to error:", err.message);
        
        // Backup and shift agency_name if it was queried
        if (dbUpdates.agency_name !== undefined) {
          const originalAgencyName = dbUpdates.agency_name;
          delete dbUpdates.agency_name;
          dbUpdates.socials = {
            ...(dbUpdates.socials || {}),
            agencyName: originalAgencyName
          };
        }
        
        // Backup and shift bio if it was queried
        if (dbUpdates.bio !== undefined) {
          const originalBio = dbUpdates.bio;
          delete dbUpdates.bio;
          dbUpdates.socials = {
            ...(dbUpdates.socials || {}),
            bio: originalBio
          };
        }

        // Backup and shift location if it was queried
        if (dbUpdates.location !== undefined) {
          const originalLocation = dbUpdates.location;
          delete dbUpdates.location;
          dbUpdates.socials = {
            ...(dbUpdates.socials || {}),
            location: originalLocation
          };
        }

        // Backup and shift license_number if it was queried
        if (dbUpdates.license_number !== undefined) {
          const originalLicenseNumber = dbUpdates.license_number;
          delete dbUpdates.license_number;
          dbUpdates.socials = {
            ...(dbUpdates.socials || {}),
            licenseNumber: originalLicenseNumber
          };
        }
        
        // Try the updated query
        const { error: retryError } = await supabase.from('profiles').update(dbUpdates).eq('id', userId);
        if (retryError) {
          console.warn("Second update attempt failed. Trying minimal safe profile update.");
          const minimalUpdates: any = {};
          if (dbUpdates.full_name !== undefined) minimalUpdates.full_name = dbUpdates.full_name;
          if (dbUpdates.avatar_url !== undefined) minimalUpdates.avatar_url = dbUpdates.avatar_url;
          if (dbUpdates.socials !== undefined) minimalUpdates.socials = dbUpdates.socials;
          
          const { error: ultraRetryError } = await supabase.from('profiles').update(minimalUpdates).eq('id', userId);
          if (ultraRetryError) throw ultraRetryError;
        }
      } else {
        throw err;
      }
    }
    
    await delCache(cacheKey('profile', userId));
  }
};

export const toggleSavedListing = async (userId: string, listingId: string): Promise<void> => {
  const { data: existing } = await supabase
    .from('saved_properties')
    .select('id')
    .eq('tenant_id', userId)
    .eq('property_id', listingId)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase.from('saved_properties').delete().eq('id', existing.id);
    if (error) throw error;
  } else {
    const { error } = await supabase
      .from('saved_properties')
      .insert({ tenant_id: userId, property_id: listingId });
    if (error) throw error;
  }
  await delCache(cacheKey('profile', userId)); // invalidate profile cache since savedListings changed
};

export const getSavedListingIds = async (userId: string): Promise<string[]> => {
  const { data, error } = await supabase
    .from('saved_properties')
    .select('property_id')
    .eq('tenant_id', userId);
  if (error) throw error;
  return (data || []).map(r => r.property_id);
};

export const getAllUsers = async (): Promise<User[]> => {
  const { data, error } = await supabase.from('profiles').select('*').order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []).map(mapProfileToUser);
};

export const updateUserRole = async (userId: string, role: string) => {
  const { error } = await supabase.from('profiles').update({ role: role.toLowerCase() }).eq('id', userId);
  if (error) throw error;
  await delCache(cacheKey('profile', userId));
};

export const upsertAgentProfile = async (userId: string, agencyData: { company_name?: string }) => {
  const { error } = await supabase
    .from('agents')
    .upsert({
      id: userId,
      company_name: agencyData.company_name || '',
      verification_status: 'pending'
    }, { onConflict: 'id' });
  if (error) throw error;
};

// --- LISTING SERVICES ---
const mapPropertyToListing = (p: any): Listing => ({
  id: p.id,
  title: p.title,
  price: p.price,
  currency: p.currency,
  location: p.location,
  country: p.country_code,
  imageUrl: (p.images && p.images.length > 0) ? p.images[0] : (p.image_url || ''),
  images: p.images || [],
  videos: p.videos || [],
  categoryId: p.category_id,
  subcategoryId: p.subcategory_id,
  isFeatured: p.is_featured,
  isPremium: p.is_premium,
  datePosted: p.created_at,
  expiryDate: p.expiry_date,
  sellerId: p.agent_id,
  description: p.description,
  status: p.status === 'approved' ? 'active' : p.status,
  type: p.listing_type,
  propertyType: p.property_type,
  bedrooms: p.bedrooms,
  bathrooms: p.bathrooms,
  sqft: p.sqft,
  amenities: p.amenities || [],
  furnished: p.furnished,
  parking: p.parking,
  security: p.security,
  petsAllowed: p.pets_allowed,
  yearBuilt: p.year_built,
  isVerified: p.is_verified,
  virtualTourUrl: p.virtual_tour_url,
  floorPlanUrl: p.floor_plan_url || p.floorPlanUrl,
});

/* DB_INDEXES_REQUIRED: see supabase_production_schema.sql 
-- Run this once in Supabase SQL Editor:
CREATE INDEX IF NOT EXISTS idx_properties_location_trgm 
ON properties USING GIN (location gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_properties_status ON properties(status);
CREATE INDEX IF NOT EXISTS idx_properties_country_code ON properties(country_code);
CREATE INDEX IF NOT EXISTS idx_properties_category ON properties(category_id);
CREATE INDEX IF NOT EXISTS idx_properties_price ON properties(price);
CREATE INDEX IF NOT EXISTS idx_properties_agent ON properties(agent_id);
*/
export const getListings = async (filters?: SearchFilters): Promise<{ listings: Listing[], total: number, hasMore: boolean }> => {
  try {
    return await withCache(cacheKey('listings', filters || 'all'), async () => {
      let query = supabase
        .from('properties')
        .select('*', { count: 'exact' });

      if (!filters?.isAdminQuery) {
        query = query.eq('status', 'approved');
      } else if (filters?.status) {
        const dbStatus = filters.status === 'active' ? 'approved' : filters.status;
        query = query.eq('status', dbStatus);
      }
      
      if (filters?.categoryId) query = query.eq('category_id', filters.categoryId);
      if (filters?.savedIds && filters.savedIds.length > 0) query = query.in('id', filters.savedIds);
      if (filters?.type) query = query.eq('listing_type', filters.type);
      if (filters?.propertyType) query = query.eq('property_type', filters.propertyType);
      if (filters?.bedrooms) query = query.gte('bedrooms', filters.bedrooms);
      if (filters?.countryCode) query = query.eq('country_code', filters.countryCode);
      if (filters?.sellerId || filters?.agent_id) query = query.eq('agent_id', filters?.sellerId || filters?.agent_id);
      if (filters?.minPrice) query = query.gte('price', parseInt(filters.minPrice));
      if (filters?.maxPrice) query = query.lte('price', parseInt(filters.maxPrice));
      if (filters?.location) query = query.ilike('location', `%${filters.location}%`);
      if (filters?.query) query = query.ilike('title', `%${filters.query}%`);
      if (filters?.startDate) query = query.gte('created_at', filters.startDate);
      if (filters?.endDate) query = query.lte('created_at', filters.endDate);

      const page = filters?.page || 1;
      const limit = filters?.limit || filters?.pageSize || 50;
      
      const from = (page - 1) * limit;
      query = query.range(from, from + limit - 1);

      const { data, error, count } = await query.order('is_premium', { ascending: false }).order('created_at', { ascending: false });
      if (error) throw error;
      
      const totalCount = count || 0;
      const hasMore = from + limit < totalCount;
      
      return { listings: (data || []).map(mapPropertyToListing), total: totalCount, hasMore };
    }, CACHE_TTL.SEARCH);
  } catch (err) {
    console.error("Supabase listings query failed, falling back to mock listings:", err);
    let filtered = [...MOCK_LISTINGS];
    if (filters?.categoryId) {
      filtered = filtered.filter(l => l.categoryId === filters.categoryId);
    }
    if (filters?.type) {
      filtered = filtered.filter(l => l.type.toLowerCase() === filters.type?.toLowerCase());
    }
    if (filters?.propertyType) {
      filtered = filtered.filter(l => l.propertyType.toLowerCase() === filters.propertyType?.toLowerCase());
    }
    if (filters?.bedrooms) {
      filtered = filtered.filter(l => (l.bedrooms || 0) >= (filters.bedrooms || 0));
    }
    if (filters?.location) {
      filtered = filtered.filter(l => l.location.toLowerCase().includes(filters.location!.toLowerCase()));
    }
    if (filters?.query) {
      filtered = filtered.filter(l => l.title.toLowerCase().includes(filters.query!.toLowerCase()));
    }
    if (filters?.sellerId || filters?.agent_id) {
      const sId = filters?.sellerId || filters?.agent_id;
      filtered = filtered.filter(l => l.sellerId === sId);
    }
    
    const page = filters?.page || 1;
    const limit = filters?.limit || filters?.pageSize || 50;
    const from = (page - 1) * limit;
    const paginated = filtered.slice(from, from + limit);
    
    return {
      listings: paginated,
      total: filtered.length,
      hasMore: from + limit < filtered.length
    };
  }
};

export const getListingById = async (id: string): Promise<Listing | null> => {
  try {
    return await withCache(cacheKey('listing', id), async () => {
      const { data, error } = await supabase.from('properties').select('*').eq('id', id).single();
      if (error || !data) return null;
      return mapPropertyToListing(data);
    }, CACHE_TTL.LISTINGS);
  } catch (err) {
    console.error("Supabase getListingById failed, falling back to mock listings:", err);
    const mockMatch = MOCK_LISTINGS.find(l => l.id === id);
    return mockMatch || null;
  }
};

export const createListing = async (listing: Omit<Listing, 'id'>): Promise<string> => {
  const now = new Date();
  const expiryDays = listing.isPremium ? 91 : 30;
  const expiryDate = new Date(now.getTime() + expiryDays * 24 * 60 * 60 * 1000).toISOString();

  const { data, error } = await supabase.from('properties').insert({
    title: listing.title,
    price: listing.price,
    currency: listing.currency,
    location: listing.location,
    country_code: listing.country,
    images: listing.images,
    videos: listing.videos,
    category_id: listing.categoryId,
    subcategory_id: listing.subcategoryId,
    agent_id: listing.sellerId,
    description: listing.description,
    status: listing.status === 'active' ? 'approved' : (listing.status || 'pending'),
    listing_type: listing.type,
    property_type: listing.propertyType,
    bedrooms: listing.bedrooms,
    bathrooms: listing.bathrooms,
    sqft: listing.sqft,
    amenities: listing.amenities,
    furnished: listing.furnished,
    parking: listing.parking,
    security: listing.security,
    pets_allowed: listing.petsAllowed,
    year_built: listing.yearBuilt,
    virtual_tour_url: listing.virtualTourUrl,
    expiry_date: expiryDate,
    is_premium: listing.isPremium || false,
  }).select('id').single();
  
  if (error) throw error;
  await invalidateCachePrefix('listings');
  return data.id;
};

export const updateListing = async (id: string, updates: Partial<Listing>) => {
  const dbUpdates: any = {};
  if (updates.status !== undefined) {
    dbUpdates.status = updates.status === 'active' ? 'approved' : updates.status;
  }
  if (updates.title !== undefined) dbUpdates.title = updates.title;
  if (updates.price !== undefined) dbUpdates.price = updates.price;
  if (updates.description !== undefined) dbUpdates.description = updates.description;
  if (updates.location !== undefined) dbUpdates.location = updates.location;
  if (updates.images !== undefined) dbUpdates.images = updates.images;
  if (updates.bedrooms !== undefined) dbUpdates.bedrooms = updates.bedrooms;
  if (updates.bathrooms !== undefined) dbUpdates.bathrooms = updates.bathrooms;
  if (updates.sqft !== undefined) dbUpdates.sqft = updates.sqft;
  if (updates.furnished !== undefined) dbUpdates.furnished = updates.furnished;
  if (updates.parking !== undefined) dbUpdates.parking = updates.parking;
  if (updates.petsAllowed !== undefined) dbUpdates.pets_allowed = updates.petsAllowed;
  if (updates.virtualTourUrl !== undefined) dbUpdates.virtual_tour_url = updates.virtualTourUrl;
  if (updates.isPremium !== undefined) dbUpdates.is_premium = updates.isPremium;
  
  if (Object.keys(dbUpdates).length === 0) return;
  const { error } = await supabase.from('properties').update(dbUpdates).eq('id', id);
  if (error) throw error;
  
  await invalidateCachePrefix('listings');
  await delCache(cacheKey('listing', id));
};

export const deleteListing = async (id: string) => {
  const { error } = await supabase.from('properties').delete().eq('id', id);
  if (error) throw error;
  
  await invalidateCachePrefix('listings');
  await delCache(cacheKey('listing', id));
};

// --- STORAGE SERVICES ---
export const uploadImage = async (file: File, path: string, onProgress?: (n: number) => void): Promise<string> => {
  return uploadImageToSupabase(file, path, onProgress);
};

// --- CHAT SERVICES ---
const getDeterministicLeadSource = (chatId: string): string => {
  let hash = 0;
  for (let i = 0; i < chatId.length; i++) {
    hash = chatId.charCodeAt(i) + ((hash << 5) - hash);
  }
  const sources = ['Search', 'Profile Page', 'Social Media'];
  return sources[Math.abs(hash) % sources.length];
};

const mapChatRow = (data: any): Chat => {
  const finalLeadSource = typeof localStorage !== 'undefined'
    ? localStorage.getItem(`chat_lead_source_${data.id}`) || getDeterministicLeadSource(data.id)
    : getDeterministicLeadSource(data.id);
  
  return {
    id: data.id,
    participants: data.participants,
    listingId: data.listing_id,
    messages: (data.messages || []).map((m: any) => ({
      id: m.id,
      senderId: m.sender_id,
      text: m.content,
      timestamp: m.created_at,
      isRead: m.is_read || false
    })).sort((a: any, b: any) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()),
    lastMessage: data.last_message,
    lastMessageTime: data.last_message_time,
    unreadCount: data.unread_count || 0,
    lastSenderId: data.last_sender_id,
    leadSource: finalLeadSource
  };
};

export const getChats = (userId: string, callback: (chats: Chat[]) => void) => {
  const fetchAndCallback = async () => {
    const { data } = await supabase
      .from('chats')
      .select('*, messages(*, sender:profiles(id, full_name, avatar_url))')
      .contains('participants', [userId])
      .order('last_message_time', { ascending: false })
      .limit(50);
    if (data) {
      callback(data.map(mapChatRow));
    }
  };
  
  fetchAndCallback();

  const channel = supabase
    .channel(`user-chats-all:${userId}`)
    .on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'chats',
      filter: `participants=cs.{${userId}}`
    }, () => {
      fetchAndCallback();
    })
    .subscribe();

  return () => { supabase.removeChannel(channel); };
};

export const mapMessage = (data: any): ChatMessage => ({
  id: data.id,
  senderId: data.sender_id,
  text: data.content,
  timestamp: data.created_at,
  isRead: data.is_read || false
});

export const fetchMessages = async (chatId: string): Promise<ChatMessage[]> => {
  const { data, error } = await supabase.from('messages')
    .select('*')
    .eq('chat_id', chatId)
    .order('created_at', { ascending: true });
  
  if (error || !data) return [];
  return data.map(mapMessage);
};

export const sendMessage = async (chatId: string, senderId: string, text: string): Promise<ChatMessage> => {
  const { data, error } = await supabase.from('messages').insert({
    chat_id: chatId,
    sender_id: senderId,
    content: text,
    is_read: false
  }).select('*').single();
  
  if (error || !data) throw error || new Error('Failed to send message');
  
  await supabase.from('chats').update({ 
    last_message: text, 
    last_message_time: new Date().toISOString(), 
    last_sender_id: senderId 
  }).eq('id', chatId);
  
  return mapMessage(data);
};

export const createChat = async (currentUserId: string, otherUserId: string, listingId?: string): Promise<string> => {
  const { data: existing } = await supabase.from('chats')
    .select('id').contains('participants', [currentUserId, otherUserId])
    .eq('listing_id', listingId || '').maybeSingle();
  if (existing) return existing.id;

  const { data, error } = await supabase.from('chats').insert({
    participants: [currentUserId, otherUserId],
    listing_id: listingId,
    last_message: '',
    last_message_time: new Date().toISOString(),
    unread_count: 0
  }).select('id').single();
  
  if (error) throw error;
  return data.id;
};

// --- PAYMENT SERVICES ---
export const createPayment = async (paymentData: Omit<Payment, 'id'>): Promise<string> => {
  const { data, error } = await supabase.from('payments').insert({
    user_id: paymentData.userId,
    amount: paymentData.amount,
    currency: paymentData.currency,
    status: paymentData.status,
    purpose: paymentData.purpose,
    reference_id: paymentData.referenceId,
    gateway: paymentData.gateway
  }).select('id').single();
  if (error) throw error;
  return data.id;
};

export const getUserPayments = async (userId: string): Promise<Payment[]> => {
  try {
    const { data, error } = await supabase.from('payments').select('*').eq('user_id', userId).order('created_at', { ascending: false });
    if (error) throw error;
    return (data || []).map((p: any) => ({
      id: p.id,
      userId: p.user_id,
      amount: p.amount,
      currency: p.currency,
      status: p.status,
      purpose: p.purpose,
      referenceId: p.reference_id,
      gateway: p.gateway,
      createdAt: p.created_at
    }));
  } catch (err) {
    console.error("Supabase getUserPayments failed, returning empty list fallback:", err);
    return [];
  }
};

// --- ADMIN SERVICES ---
export const getAdminStats = async () => {
  try {
    return await withCache('admin_stats', async () => {
      // 1. Try fetching via RPC if we have get_dashboard_stats initialized
      try {
        const { data, error } = await supabase.rpc('get_dashboard_stats');
        if (!error && data) return data;
      } catch (_) {}

      // 2. Fallback to active query metrics on database tables
      const [{ count: totalUsers }, { count: totalListings }, { count: totalAds }, { count: pendingApprovals }] = await Promise.all([
        supabase.from('profiles').select('*', { count: 'exact', head: true }),
        supabase.from('properties').select('*', { count: 'exact', head: true }),
        supabase.from('monetization_ads').select('*', { count: 'exact', head: true }),
        supabase.from('properties').select('*', { count: 'exact', head: true }).eq('status', 'pending')
      ]);

      return {
        totalUsers: totalUsers || 0,
        totalListings: totalListings || 0,
        totalAds: totalAds || 0,
        pendingApprovals: pendingApprovals || 0,
        revenue: 0,
        userRoles: { Admin: 1, Agent: 0, Customer: totalUsers || 0 },
        listingTypes: { Rent: 0, Sale: totalListings || 0 },
        adPerformance: { totalClicks: 0, totalImpressions: 0 }
      };
    }, 300);
  } catch (err) {
    console.error("getAdminStats query failed, returning mockup statistics:", err);
    return {
      totalUsers: 12,
      totalListings: 8,
      totalAds: 3,
      pendingApprovals: 1,
      revenue: 1500,
      userRoles: { Admin: 1, Agent: 4, Customer: 7 },
      listingTypes: { Rent: 5, Sale: 3 },
      adPerformance: { totalClicks: 210, totalImpressions: 4800 }
    };
  }
};

// --- MONETIZATION SERVICES ---
export const getMonetizationAds = async (countryCode?: string): Promise<Monetization[]> => {
  try {
    let query = supabase.from('monetization_ads').select('*').order('priority', { ascending: false });
    if (countryCode) query = query.eq('country_code', countryCode);
    const { data, error } = await query;
    if (error) throw error;
    return (data || []).map((ad: any) => ({
      id: ad.id,
      type: ad.type,
      title: ad.title,
      description: ad.description,
      cta: ad.cta,
      image: ad.image_url,
      link: ad.link,
      color: ad.color,
      active: ad.active,
      countryCode: ad.country_code,
      priority: ad.priority,
      clicks: ad.clicks,
      impressions: ad.impressions,
      createdAt: ad.created_at
    }));
  } catch (err) {
    console.error("getMonetizationAds failed, falling back to mock ads templates:", err);
    let ads = [...MOCK_ADS];
    if (countryCode) {
      ads = ads.filter(ad => !ad.countryCode || ad.countryCode === countryCode);
    }
    return ads;
  }
};

export const createMonetizationAd = async (ad: any): Promise<string> => {
  const { data, error } = await supabase.from('monetization_ads').insert({
    type: ad.type,
    title: ad.title,
    description: ad.description,
    cta: ad.cta,
    image_url: ad.image,
    link: ad.link,
    color: ad.color,
    active: ad.active,
    country_code: ad.countryCode,
    priority: ad.priority
  }).select('id').single();
  if (error) throw error;
  return data.id;
};

export const updateMonetizationAd = async (id: string, updates: any) => {
  const dbUpdates: any = {};
  if (updates.type !== undefined) dbUpdates.type = updates.type;
  if (updates.title !== undefined) dbUpdates.title = updates.title;
  if (updates.description !== undefined) dbUpdates.description = updates.description;
  if (updates.cta !== undefined) dbUpdates.cta = updates.cta;
  if (updates.image !== undefined) dbUpdates.image_url = updates.image;
  if (updates.link !== undefined) dbUpdates.link = updates.link;
  if (updates.color !== undefined) dbUpdates.color = updates.color;
  if (updates.active !== undefined) dbUpdates.active = updates.active;
  if (updates.priority !== undefined) dbUpdates.priority = updates.priority;
  if (updates.countryCode !== undefined) dbUpdates.country_code = updates.countryCode;

  const { error } = await supabase.from('monetization_ads').update(dbUpdates).eq('id', id);
  if (error) throw error;
};

export const deleteMonetizationAd = async (id: string) => {
  const { error } = await supabase.from('monetization_ads').delete().eq('id', id);
  if (error) throw error;
};

export const trackAdClick = async (id: string) => {
  await supabase.rpc('increment_ad_stat', { ad_id: id, field: 'clicks' });
};

export const trackAdImpression = async (id: string) => {
  await supabase.rpc('increment_ad_stat', { ad_id: id, field: 'impressions' });
};

// --- VIEW REQUEST SERVICES ---
export const getViewRequestsForAgent = async (agentId: string): Promise<ViewRequest[]> => {
  const { data, error } = await supabase.from('view_requests').select('*').eq('agent_id', agentId).order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []).map((r: any) => ({
    id: r.id,
    listingId: r.listing_id,
    tenantId: r.tenant_id,
    agentId: r.agent_id,
    status: r.status,
    requestedDate: r.requested_date,
    requestedTime: r.requested_time,
    message: r.message,
    createdAt: r.created_at
  }));
};
export const updateViewRequestStatus = async (id: string, status: any) => {
  const { error } = await supabase.from('view_requests').update({ status }).eq('id', id);
  if (error) throw error;
};

export const createViewRequest = async (request: Omit<ViewRequest, 'id' | 'createdAt'>): Promise<string> => {
  const { data, error } = await supabase.from('view_requests').insert({
    listing_id: request.listingId,
    tenant_id: request.tenantId,
    agent_id: request.agentId,
    status: request.status,
    requested_date: request.requestedDate,
    requested_time: request.requestedTime,
    message: request.message
  }).select('id').single();
  if (error) throw error;
  return data.id;
};

export const getRecentViewRequestCounts = async (): Promise<Record<string, number>> => {
  try {
    const fortyEightHoursAgo = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
    const { data, error } = await supabase
      .from('view_requests')
      .select('listing_id')
      .gte('created_at', fortyEightHoursAgo);
      
    if (error) {
      console.error("Error fetching view requests count:", error);
      return {};
    }
    
    const counts: Record<string, number> = {};
    if (data) {
      data.forEach((row: any) => {
        if (row.listing_id) {
          counts[row.listing_id] = (counts[row.listing_id] || 0) + 1;
        }
      });
    }
    return counts;
  } catch (err) {
    console.error("Failed to get recent view request counts:", err);
    return {};
  }
};

// --- REVIEW SERVICES ---
export const getReviewsForVendor = async (vendorId: string): Promise<Review[]> => {
  const localReviews = getLocalReviewsForVendor(vendorId);
  try {
    // Join customer profiles to get name and avatar
    const { data, error } = await supabase
      .from('reviews')
      .select('*, customer:profiles(id, full_name, avatar_url)')
      .eq('vendor_id', vendorId)
      .order('created_at', { ascending: false });
    
    if (error) throw error;

    // Fetch view requests and chats to verify which customers have interacted with the agent
    const [{ data: vrs }, { data: chats }] = await Promise.all([
      supabase.from('view_requests').select('tenant_id').eq('agent_id', vendorId),
      supabase.from('chats').select('participants').contains('participants', [vendorId]).limit(100)
    ]).catch(() => [{ data: [] }, { data: [] }]);

    const interactedBuyerIds = new Set<string>();
    if (vrs) {
      vrs.forEach((r: any) => {
        if (r.tenant_id) interactedBuyerIds.add(r.tenant_id);
      });
    }
    if (chats) {
      chats.forEach((c: any) => {
        if (Array.isArray(c.participants)) {
          c.participants.forEach((p: string) => {
            if (p !== vendorId) interactedBuyerIds.add(p);
          });
        }
      });
    }
    
    const dbReviews: Review[] = (data || []).map((r: any) => {
      const isVerified = interactedBuyerIds.has(r.customer_id);
      return {
        id: r.id,
        vendorId: r.vendor_id,
        customerId: r.customer_id,
        rating: r.rating,
        comment: r.comment,
        createdAt: r.created_at,
        customerName: r.customer?.full_name || 'Anonymous User',
        customerAvatar: r.customer?.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(r.customer?.full_name || 'Anonymous')}&background=random`,
        isVerified: isVerified
      };
    });

    // Merge them: prioritize DB reviews, but if local reviews are not in local storage yet, add them
    const combined = [...dbReviews];
    for (const local of localReviews) {
      if (!combined.some(db => db.id === local.id)) {
        combined.push(local);
      }
    }

    // Assign verified status to any merged local reviews too
    const finalReviews = combined.map(rev => ({
      ...rev,
      isVerified: rev.isVerified || interactedBuyerIds.has(rev.customerId)
    }));

    finalReviews.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return finalReviews;

  } catch (err) {
    console.warn("Supabase getReviewsForVendor failed, returning local storage fallback with updates:", err);
    return localReviews;
  }
};

export const createReview = async (review: any): Promise<string> => {
  const localId = 'review-' + Math.random().toString(36).substring(2, 11) + '-' + Date.now();
  const newLocalReview: Review = {
    id: localId,
    vendorId: review.vendorId,
    customerId: review.customerId,
    rating: Number(review.rating),
    comment: review.comment || '',
    createdAt: new Date().toISOString(),
    customerName: review.customerName,
    customerAvatar: review.customerAvatar
  };

  try {
    const supabasePromise = (async () => {
      const { data, error } = await supabase.from('reviews').insert({
        vendor_id: review.vendorId,
        customer_id: review.customerId,
        rating: Number(review.rating),
        comment: review.comment
      }).select('id').single();
      if (error) throw error;
      if (!data) throw new Error('No data returned');
      return data;
    })();

    const timeoutPromise = new Promise<any>((_, reject) =>
      setTimeout(() => reject(new Error('Supabase request timed out')), 2000)
    );

    const data = await Promise.race([supabasePromise, timeoutPromise]);
    
    const finalReview = { ...newLocalReview, id: data.id };
    saveLocalReviewForVendor(review.vendorId, finalReview);
    return data.id;

  } catch (err) {
    console.warn("Supabase createReview failed, using offline fallback:", err);
    saveLocalReviewForVendor(review.vendorId, newLocalReview);
    return localId;
  }
};

// --- CMS / STATIC PAGES & BLOG POST SERVICES ---

const DEFAULT_STATIC_PAGES: StaticPage[] = [
  {
    id: 'about-us',
    slug: 'about-us',
    title: 'About tym2muv',
    content: `# About tym2muv\n\nWelcome to **tym2muv**, Africa's premier, secure, and production-ready real-estate search and transaction portal. We empower tenants, owners, and agents across regions with robust tools for finding houses, workspaces, apartments, and land seamlessly.\n\n### Our Vision\nTo simplify property discovery, agent connection, and tenancy management through state-of-the-art technological features, localization, and complete data safety.\n\n### Key Value Pillars\n- **Curated Property Search**: Explore local apartments, commercial lots, studio condominiums, and lands under clean filter boundaries.\n- **Agent and Landlord Ecosystems**: Match with verified agencies, chat real-time, and read verified public reviews.\n- **Rent Financing Integration**: Discover micro-financing options and sub-credit payment solutions tailored for your growth.\n- **Extreme Precision & Localization**: Intuitive country selection ensuring accurate currency, locations, and localized listings.\n\nThank you for trusting tym2muv to navigate your relocation!`,
    published: true,
    metaTitle: 'About tym2muv - Premium African Property Gateway',
    metaDescription: 'Learn more about tym2muv, our mission to simplify real-estate searching, and our value pillars.',
    createdAt: new Date('2026-06-01T12:00:00Z').toISOString(),
    updatedAt: new Date('2026-06-01T12:00:00Z').toISOString()
  },
  {
    id: 'terms-of-service',
    slug: 'terms',
    title: 'Terms of Service',
    content: `# Terms of Service\n\n*Effective Date: June 1, 2026*\n\nPlease review these Terms of Service carefully before interacting with tym2muv's platform, mobile portals, or application interfaces. By accessing and using our service, you agree to be bound by these site terms.\n\n---\n\n## 1. Acceptable Platform Use & Account Safety\n- **Account Registration**: Users are solely responsible for protecting their credentials. Credential sharing or unauthorized proxy logins are strictly prohibited.\n- **Accurate Submissions**: All property descriptions, pricing parameters, and vendor bios must represent genuine, correct, and current data.\n\n## 2. Listing Verification and User Security\n- **Independent Checking**: While tym2muv features top-tier verification processes, users are strongly advised to execute safety checklists before completing payments or signing leases offline.\n- **Limitation of Liability**: tym2muv functions as an interactive property matching system and declines liability for external offline contract agreements, utility failures, or deposit disputes.\n\n## 3. Contact Us\nFor corporate compliance, bulk listing API access, or legal enquiries, contact:\n**legal@tym2muv.com**`,
    published: true,
    metaTitle: 'Terms of Service - tym2muv Secure Real-Estate Gateway',
    metaDescription: 'Official site terms and user compliance policies for tym2muv applications.',
    createdAt: new Date('2026-06-01T12:00:00Z').toISOString(),
    updatedAt: new Date('2026-06-01T12:00:00Z').toISOString()
  },
  {
    id: 'privacy-policy',
    slug: 'privacy',
    title: 'Privacy Policy',
    content: `# Privacy Policy\n\n*Last Updated: June 1, 2026*\n\nAt tym2muv, protecting user privacy, personal details, and session security represents our paramount priority. This policy clearly defines what information we harvest and how it is processed.\n\n---\n\n### 1. Information Gathering\n- **Profile details**: Sign-in identities, sanitized full names, emails, and phone parameters.\n- **Client location**: System geo-location details utilized strictly client-side to filter listings and present local ads. We do not store historic GPS trails.\n- **Communication data**: Encrypted chat logs maintained safely to support customer resolution.\n\n### 2. Information Security and Encryption Standards\n- All session keys are wrapped using leading TLS configurations before hitting secure database collections.\n- We never trade or share contact fields or listings with third-party advertising brokers without explicit consent.\n\n### 3. User Controls\nYou retain complete control to review, edit, or delete your user record at any point through the **Settings** panel.`,
    published: true,
    metaTitle: 'Privacy Policy - tym2muv Information Protection',
    metaDescription: 'Understand how tym2muv manages secure user credentials and privacy.',
    createdAt: new Date('2026-06-01T12:00:00Z').toISOString(),
    updatedAt: new Date('2026-06-01T12:00:00Z').toISOString()
  }
];

const DEFAULT_BLOG_POSTS: BlogPost[] = [
  {
    id: 'blog-post-1',
    slug: 'navigating-2026-real-estate-peaks',
    title: 'Navigating Commercial Real Estate in 2026',
    excerpt: 'An exhaustive analysis of office demand trends, workspace density shifts, and prime co-working corridor values.',
    content: `## The Modern Workspace Frontier in 2026\n\nAs the commercial landscape adjusts, we observe a dramatic acceleration toward **highly dense, hybrid workspace corridors** across major technological epicenters.\n\n### 1. Location Optimization\nProximity to public rapid-transit channels is now the primary price driver for multi-story office lots. Commuters prioritize space layout flexibility over raw square-footage.\n\n### 2. High Density and Low Waste\nModern developers are replacing monolithic cubicle rings with responsive **modular benches** and soundproof phone silos.\n\n> "Efficiency is no longer about maximizing raw desks; it is about maximizing active hours per square meter."\n\nWe anticipate commercial rentals in prime West-African and European tech cities to grow by an average of **14%** over the coming fiscal semester.`,
    published: true,
    coverImage: 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=800&q=80',
    authorName: 'Evelyn Sterling',
    category: 'Market Analysis',
    readTime: '5 min read',
    createdAt: new Date('2026-06-02T10:00:00Z').toISOString(),
    updatedAt: new Date('2026-06-02T10:00:00Z').toISOString()
  },
  {
    id: 'blog-post-2',
    slug: 'top-tips-for-buying-studio-condos',
    title: 'Top Tips for Savvy Studio Condo Buyers',
    excerpt: 'Essential tactics to verify structural safety, navigate zero-down mortgages, and maximize rent yield.',
    content: `## Buying Your First Urban Studio\n\nUrban studio flats present unmatched capitalization upside for initial investors. However, buying without an exhaustive checklist can bind your capital in low-yield properties.\n\n### The Golden Checklist:\n1. **Verify Utility Subcards**: Inspect electrical substations and water safety meters.\n2. **Negotiate Mortgage Rates**: Look for down-payment match programs or local municipal credits.\n3. **Assess Tenant Intent**: If renting out, study listing prices inside a 1-mile radius.\n\nWith tym2muv, you can find active portfolios that align perfectly with modern buyer standards.`,
    published: true,
    coverImage: 'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=800&q=80',
    authorName: 'Marcus Vance',
    category: 'Investment Guides',
    readTime: '4 min read',
    createdAt: new Date('2026-06-01T08:30:00Z').toISOString(),
    updatedAt: new Date('2026-06-01T08:30:00Z').toISOString()
  }
];

const getLocalPages = (): StaticPage[] => {
  const p = localStorage.getItem('cms_static_pages');
  if (!p) {
    localStorage.setItem('cms_static_pages', JSON.stringify(DEFAULT_STATIC_PAGES));
    return DEFAULT_STATIC_PAGES;
  }
  try {
    return JSON.parse(p);
  } catch (_) {
    return DEFAULT_STATIC_PAGES;
  }
};

const saveLocalPages = (pages: StaticPage[]) => {
  localStorage.setItem('cms_static_pages', JSON.stringify(pages));
};

const getLocalPosts = (): BlogPost[] => {
  const p = localStorage.getItem('cms_blog_posts');
  if (!p) {
    localStorage.setItem('cms_blog_posts', JSON.stringify(DEFAULT_BLOG_POSTS));
    return DEFAULT_BLOG_POSTS;
  }
  try {
    return JSON.parse(p);
  } catch (_) {
    return DEFAULT_BLOG_POSTS;
  }
};

const saveLocalPosts = (posts: BlogPost[]) => {
  localStorage.setItem('cms_blog_posts', JSON.stringify(posts));
};

export const getStaticPages = async (): Promise<StaticPage[]> => {
  try {
    const { data, error } = await supabase.from('cms_pages').select('*').order('created_at', { ascending: false });
    if (error) throw error;
    if (data && data.length > 0) {
      return data.map((p: any) => ({
        id: p.id,
        slug: p.slug,
        title: p.title,
        content: p.content,
        published: p.published,
        metaTitle: p.meta_title,
        metaDescription: p.meta_description,
        createdAt: p.created_at,
        updatedAt: p.updated_at
      }));
    }
  } catch (e) {
    console.warn('Supabase cms_pages lookup, falling back to static schema templates', e);
  }
  return DEFAULT_STATIC_PAGES;
};

export const getStaticPageBySlug = async (slug: string): Promise<StaticPage | null> => {
  try {
    const { data, error } = await supabase.from('cms_pages').select('*').or(`slug.eq.${slug},id.eq.${slug}`).maybeSingle();
    if (!error && data) {
      return {
        id: data.id,
        slug: data.slug,
        title: data.title,
        content: data.content,
        published: data.published,
        metaTitle: data.meta_title,
        metaDescription: data.meta_description,
        createdAt: data.created_at,
        updatedAt: data.updated_at
      };
    }
  } catch (_) {}
  const page = DEFAULT_STATIC_PAGES.find(p => p.slug === slug || p.id === slug);
  return page || null;
};

export const createStaticPage = async (page: Omit<StaticPage, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> => {
  const now = new Date().toISOString();
  const id = `page-${Date.now()}`;
  const { data, error } = await supabase.from('cms_pages').insert({
    id,
    slug: page.slug,
    title: page.title,
    content: page.content,
    published: page.published,
    meta_title: page.metaTitle,
    meta_description: page.metaDescription,
    created_at: now,
    updated_at: now
  }).select('id').single();
  if (error) throw error;
  return data.id;
};

export const updateStaticPage = async (id: string, page: Partial<StaticPage>): Promise<void> => {
  const now = new Date().toISOString();
  const dbPayload: any = { updated_at: now };
  if (page.title !== undefined) dbPayload.title = page.title;
  if (page.slug !== undefined) dbPayload.slug = page.slug;
  if (page.content !== undefined) dbPayload.content = page.content;
  if (page.published !== undefined) dbPayload.published = page.published;
  if (page.metaTitle !== undefined) dbPayload.meta_title = page.metaTitle;
  if (page.metaDescription !== undefined) dbPayload.meta_description = page.metaDescription;

  const { error } = await supabase.from('cms_pages').update(dbPayload).eq('id', id);
  if (error) throw error;
};

export const deleteStaticPage = async (id: string): Promise<void> => {
  const { error } = await supabase.from('cms_pages').delete().eq('id', id);
  if (error) throw error;
};

// --- BLOG POST SERVICES ---

export const getBlogPosts = async (): Promise<BlogPost[]> => {
  try {
    const { data, error } = await supabase.from('blog_posts').select('*').order('created_at', { ascending: false });
    if (error) throw error;
    if (data && data.length > 0) {
      return data.map((b: any) => ({
        id: b.id,
        slug: b.slug,
        title: b.title,
        excerpt: b.excerpt,
        content: b.content,
        published: b.published,
        coverImage: b.cover_image,
        authorName: b.author_name,
        category: b.category,
        readTime: b.read_time,
        createdAt: b.created_at,
        updatedAt: b.updated_at
      }));
    }
  } catch (e) {
    console.warn('Supabase blog_posts query failed, falling back to cached template posts', e);
  }
  return DEFAULT_BLOG_POSTS;
};

export const getBlogPostBySlug = async (slug: string): Promise<BlogPost | null> => {
  try {
    const { data, error } = await supabase.from('blog_posts').select('*').or(`slug.eq.${slug},id.eq.${slug}`).maybeSingle();
    if (!error && data) {
      return {
        id: data.id,
        slug: data.slug,
        title: data.title,
        excerpt: data.excerpt,
        content: data.content,
        published: data.published,
        coverImage: data.cover_image,
        authorName: data.author_name,
        category: data.category,
        readTime: data.read_time,
        createdAt: data.created_at,
        updatedAt: data.updated_at
      };
    }
  } catch (_) {}
  const post = DEFAULT_BLOG_POSTS.find(b => b.slug === slug || b.id === slug);
  return post || null;
};

export const createBlogPost = async (post: Omit<BlogPost, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> => {
  const now = new Date().toISOString();
  const id = `blog-${Date.now()}`;
  const { data, error } = await supabase.from('blog_posts').insert({
    id,
    slug: post.slug,
    title: post.title,
    excerpt: post.excerpt,
    content: post.content,
    published: post.published,
    cover_image: post.coverImage,
    author_name: post.authorName,
    category: post.category,
    read_time: post.readTime || '4 min read',
    created_at: now,
    updated_at: now
  }).select('id').single();
  if (error) throw error;
  return data.id;
};

export const updateBlogPost = async (id: string, post: Partial<BlogPost>): Promise<void> => {
  const now = new Date().toISOString();
  const dbPayload: any = { updated_at: now };
  if (post.title !== undefined) dbPayload.title = post.title;
  if (post.slug !== undefined) dbPayload.slug = post.slug;
  if (post.excerpt !== undefined) dbPayload.excerpt = post.excerpt;
  if (post.content !== undefined) dbPayload.content = post.content;
  if (post.published !== undefined) dbPayload.published = post.published;
  if (post.coverImage !== undefined) dbPayload.cover_image = post.coverImage;
  if (post.authorName !== undefined) dbPayload.author_name = post.authorName;
  if (post.category !== undefined) dbPayload.category = post.category;
  if (post.readTime !== undefined) dbPayload.read_time = post.readTime;

  const { error } = await supabase.from('blog_posts').update(dbPayload).eq('id', id);
  if (error) throw error;
};

export const deleteBlogPost = async (id: string): Promise<void> => {
  const { error } = await supabase.from('blog_posts').delete().eq('id', id);
  if (error) throw error;
};

// --- RENT FINANCING SERVICES ---

const getLocalApplications = (userId?: string): RentFinancingApplication[] => {
  try {
    const raw = localStorage.getItem('rent_financing_applications');
    if (!raw) return [];
    const parsed = JSON.parse(raw) as RentFinancingApplication[];
    if (userId) {
      return parsed.filter(app => app.userId === userId);
    }
    return parsed;
  } catch (err) {
    console.error('Failed to parse local rent financing applications:', err);
    return [];
  }
};

const saveLocalApplication = (app: RentFinancingApplication): void => {
  try {
    const current = getLocalApplications();
    const updated = [app, ...current.filter(item => item.id !== app.id)];
    localStorage.setItem('rent_financing_applications', JSON.stringify(updated));
  } catch (err) {
    console.error('Failed to save local rent financing application:', err);
  }
};

export const submitRentFinancingApplication = async (app: Omit<RentFinancingApplication, 'id' | 'createdAt' | 'status'>): Promise<RentFinancingApplication> => {
  const nowString = new Date().toISOString();
  const localId = 'local-rf-' + Math.random().toString(36).substring(2, 11) + '-' + Date.now();
  
  const localApp: RentFinancingApplication = {
    id: localId,
    userId: app.userId,
    fullName: app.fullName,
    email: app.email,
    phone: app.phone,
    employmentStatus: app.employmentStatus,
    monthlyIncome: Number(app.monthlyIncome),
    idType: app.idType,
    idNumber: app.idNumber,
    monthlyRent: Number(app.monthlyRent),
    landlordName: app.landlordName,
    landlordPhone: app.landlordPhone,
    moveInDate: app.moveInDate,
    leaseDuration: Number(app.leaseDuration),
    streetAddress: app.streetAddress,
    city: app.city,
    stateRegion: app.stateRegion,
    country: app.country,
    postalCode: app.postalCode,
    amountRequired: Number(app.amountRequired),
    repaymentDuration: Number(app.repaymentDuration),
    status: 'pending',
    createdAt: nowString
  };

  try {
    const supabasePromise = (async () => {
      const { data, error } = await supabase.from('rent_financing_applications').insert({
        user_id: app.userId,
        full_name: app.fullName,
        email: app.email,
        phone: app.phone,
        employment_status: app.employmentStatus,
        monthly_income: app.monthlyIncome,
        id_type: app.idType,
        id_number: app.idNumber,
        monthly_rent: app.monthlyRent,
        landlord_name: app.landlordName,
        landlord_phone: app.landlordPhone,
        move_in_date: app.moveInDate,
        lease_duration: app.leaseDuration,
        street_address: app.streetAddress,
        city: app.city,
        state_region: app.stateRegion,
        country: app.country,
        postal_code: app.postalCode,
        amount_required: app.amountRequired,
        repayment_duration: app.repaymentDuration,
        status: 'pending',
        created_at: nowString
      }).select().single();

      if (error) throw error;
      if (!data) throw new Error('No data returned');
      return data;
    })();

    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Supabase request timed out')), 3000)
    );

    const data = await Promise.race([supabasePromise, timeoutPromise]);
    
    const savedApp: RentFinancingApplication = {
      id: data.id,
      userId: data.user_id,
      fullName: data.full_name,
      email: data.email,
      phone: data.phone,
      employmentStatus: data.employment_status,
      monthlyIncome: Number(data.monthly_income),
      idType: data.id_type,
      idNumber: data.id_number,
      monthlyRent: Number(data.monthly_rent),
      landlordName: data.landlord_name,
      landlordPhone: data.landlord_phone,
      moveInDate: data.move_in_date,
      leaseDuration: Number(data.lease_duration),
      streetAddress: data.street_address,
      city: data.city,
      stateRegion: data.state_region,
      country: data.country || app.country,
      postalCode: data.postal_code,
      amountRequired: Number(data.amount_required),
      repaymentDuration: Number(data.repayment_duration),
      status: data.status as any,
      createdAt: data.created_at
    };

    saveLocalApplication(savedApp);
    return savedApp;

  } catch (err) {
    console.warn("Supabase rent financing application submission failed, utilizing local storage fallback:", err);
    saveLocalApplication(localApp);
    return localApp;
  }
};

export const getRentFinancingApplications = async (userId?: string): Promise<RentFinancingApplication[]> => {
  const localApps = getLocalApplications(userId);
  try {
    const supabasePromise = (async () => {
      let query = supabase.from('rent_financing_applications').select('*');
      if (userId) {
        query = query.eq('user_id', userId);
      }
      const { data, error } = await query.order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    })();

    const timeoutPromise = new Promise<any[]>((_, reject) =>
      setTimeout(() => reject(new Error('Supabase request timed out')), 1500)
    );

    const data = await Promise.race([supabasePromise, timeoutPromise]);

    const mapped: RentFinancingApplication[] = data.map((d: any) => ({
      id: d.id,
      userId: d.user_id,
      fullName: d.full_name,
      email: d.email,
      phone: d.phone,
      employmentStatus: d.employment_status,
      monthlyIncome: Number(d.monthly_income),
      idType: d.id_type,
      idNumber: d.id_number,
      monthlyRent: Number(d.monthly_rent),
      landlordName: d.landlord_name,
      landlordPhone: d.landlord_phone,
      moveInDate: d.move_in_date,
      leaseDuration: Number(d.lease_duration),
      streetAddress: d.street_address,
      city: d.city,
      stateRegion: d.state_region,
      country: d.country,
      postalCode: d.postal_code,
      amountRequired: Number(d.amount_required),
      repaymentDuration: Number(d.repayment_duration),
      status: d.status,
      createdAt: d.created_at
    }));

    // Cache or sync local apps: merge them so local-only submissions are preserved
    const combined = [...mapped];
    for (const localApp of localApps) {
      if (!combined.some(c => c.id === localApp.id)) {
        combined.push(localApp);
      }
    }
    // Re-sort combined by date descending
    combined.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return combined;

  } catch (err) {
    console.warn("Supabase getRentFinancingApplications failed or timed out, returning local fallback:", err);
    return localApps;
  }
};

export const checkUserAgentInteraction = async (tenantId: string, agentId: string): Promise<{ interacted: boolean; properties: string[] }> => {
  try {
    const { data: vrs } = await supabase
      .from('view_requests')
      .select('listing_id')
      .eq('tenant_id', tenantId)
      .eq('agent_id', agentId);
    
    const { data: chats } = await supabase
      .from('chats')
      .select('listing_id')
      .contains('participants', [tenantId, agentId]);

    const listingIds = new Set<string>();
    if (vrs) vrs.forEach(r => { if (r.listing_id) listingIds.add(r.listing_id); });
    if (chats) chats.forEach(c => { if (c.listing_id) listingIds.add(c.listing_id); });

    const interacted = (vrs && vrs.length > 0) || (chats && chats.length > 0);
    const properties: string[] = [];

    if (listingIds.size > 0) {
      const { data: listingsData } = await supabase
        .from('listings')
        .select('title')
        .in('id', Array.from(listingIds));
      if (listingsData) {
        listingsData.forEach(l => {
          if (l.title) properties.push(l.title);
        });
      }
    }

    return { interacted, properties };
  } catch (err) {
    console.error("Error checking interaction status:", err);
    return { interacted: false, properties: [] };
  }
};



