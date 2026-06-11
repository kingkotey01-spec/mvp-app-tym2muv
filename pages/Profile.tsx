import React, { useState, useEffect, useMemo } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { getUserProfile, getListings, getReviewsForVendor, createReview } from '../services/supabaseService';
import { User, Listing, Review } from '../types';
import ListingCard from '../components/ListingCard';
import AdCard from '../components/AdCard';
import Icon from '../components/Icon';
import AgentMonetizationDash from '../components/AgentMonetizationDash';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import { useMixedContent } from '../hooks/useMixedContent';
import { getOptimizedImageUrl } from '../utils/imageOptimization';
import SimulatedInbox from '../components/SimulatedInbox';

const Profile: React.FC = () => {
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();
  const { user: currentUser, isAuthReady, isAuthenticated, logout } = useAuth();
  const { toast } = useToast();
  const [user, setUser] = useState<User | undefined>(undefined);
  const [listings, setListings] = useState<Listing[]>([]);
  const [savedListings, setSavedListings] = useState<Listing[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [activeTab, setActiveTab] = useState('listings');
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState('');
  const [showReviewForm, setShowReviewForm] = useState(false);
  const isMe = currentUser?.id === user?.id;

  // Define some ads to intersperse
  const ads = [
    {
      type: 'tall' as const,
      title: 'Boost Your Profile',
      description: 'Get a verified badge and stand out from the crowd.',
      cta: 'Get Verified',
      image: 'https://picsum.photos/seed/ad-p1/400/800',
      color: 'from-brand-600 to-fuchsia-600'
    }
  ];

  // Mix listings and ads
  const mixedContent = useMixedContent(listings, ads, 8, 5, false);

  useEffect(() => {
    let active = true;

    const fetchProfileData = async () => {
      // --- FIX: Wait until auth is fully resolved before doing anything ---
      // If auth is still initialising, hold in loading state and wait for next render
      if (!isAuthReady) {
        if (active) setIsLoading(true);
        return;
      }

      let targetId: string | undefined;

      if (userId === 'me' || !userId) {
        // "me" route: must have a logged-in user
        if (!isAuthenticated) {
          // Auth is ready but no user session → send to sign-in
          navigate('/signin', { replace: true });
          return;
        }
        if (!currentUser) {
          // Session exists, but profile document is still loading inside AuthContext
          return;
        }
        targetId = currentUser.id;
      } else {
        targetId = userId;
      }

      window.scrollTo(0, 0);
      if (active) setIsLoading(true);
      
      try {
        const u = await getUserProfile(targetId);
        if (!active) return;

        setUser(u ?? undefined);
        if (u) {
          // Set correct default active tab based on role
          const defaultTab =
            u.role === 'Tenant' ? 'saved' :
            (u.role === 'Agent' || u.role === 'Admin') ? 'listings' : 'reviews';
          setActiveTab(defaultTab);

          // Fetch listings and reviews in parallel
          const [listingsRes, reviewsRes] = await Promise.all([
            getListings({ sellerId: u.id, limit: 50 }).catch(() => ({ listings: [] })),
            getReviewsForVendor(u.id).catch(() => [])
          ]);

          if (!active) return;

          setListings(listingsRes.listings);
          setReviews(reviewsRes);
          
          // If viewing own tenant profile, fetch saved listings
          if (targetId === currentUser?.id && u.role === 'Tenant' && u.savedListings?.length) {
            const allListingsRes = await getListings({ limit: 100 }).catch(() => ({ listings: [] }));
            if (!active) return;
            setSavedListings(allListingsRes.listings.filter(l => u.savedListings?.includes(l.id)));
            setActiveTab('saved'); // Default to saved tab for tenants
          }
        }
      } catch (error) {
        console.error("Error fetching profile data:", error);
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    };

    fetchProfileData();

    return () => {
      active = false;
    };
  }, [userId, currentUser?.id, isAuthReady, isAuthenticated]);

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({
        title: `Check out ${user?.name}'s properties on ${user?.agencyName || 'tym2muv'}`,
        url: window.location.href
      }).catch(console.error);
    } else {
      navigator.clipboard.writeText(window.location.href);
      toast('Profile link copied to clipboard!', 'success');
    }
  };

  const handleSubmitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || !user) return;
    
    setIsSubmittingReview(true);
    try {
      await createReview({
        vendorId: user.id,
        customerId: currentUser.id,
        rating: reviewRating,
        comment: reviewComment
      });
      
      // Refresh reviews and user profile
      const [updatedReviews, updatedUser] = await Promise.all([
        getReviewsForVendor(user.id),
        getUserProfile(user.id)
      ]);
      
      setReviews(updatedReviews);
      if (updatedUser) setUser(updatedUser);
      
      setShowReviewForm(false);
      setReviewComment('');
      setReviewRating(5);
    } catch (error) {
      console.error("Error submitting review:", error);
      toast("Failed to submit review. Please try again.", "error");
    } finally {
      setIsSubmittingReview(false);
    }
  };

  if (isLoading || !isAuthReady) {
    return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] animate-fade-in">
            <div className="animate-spin text-brand-500 mb-4"><Icon name="loader" size={40} /></div>
            <p className="text-slate-500 font-medium">Finding user profile...</p>
        </div>
    );
  }

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] animate-fade-in">
          <div className="text-slate-300 mb-4"><Icon name="user" size={64} /></div>
          <h2 className="text-xl font-bold text-slate-800">User Not Found</h2>
          <p className="text-slate-500 mt-1">The profile you're looking for doesn't exist.</p>
          <Link to="/" className="mt-6 px-6 py-3 bg-brand-600 text-white rounded-xl font-bold">
            Back to Home
          </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-4"> {/* Standardized padding */}
      {/* Cover Photo Area with Parallax Effect */}
      <div className="h-32 md:h-44 bg-gradient-to-br from-brand-600 via-purple-600 to-fuchsia-500 relative overflow-hidden">
          <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10"></div>
          <div className="absolute inset-0 bg-black/10"></div>
          
          {/* Animated Background Shapes */}
          <div className="absolute top-10 right-10 w-64 h-64 bg-white/10 rounded-full blur-3xl animate-float-slow"></div>
          <div className="absolute bottom-10 left-10 w-48 h-48 bg-fuchsia-400/20 rounded-full blur-2xl animate-float-medium"></div>
      </div>

      <div className="container mx-auto px-2 -mt-12 md:-mt-16 relative z-10 animate-slide-up">
        <div className="glass-strong rounded-3xl p-4 md:p-6 shadow-xl ring-1 ring-white/60">
            <div className="flex flex-col lg:flex-row items-start lg:items-end gap-4 mb-5">
                {/* Avatar */}
                <div className="relative group">
                    <div className="absolute -inset-1 bg-gradient-to-br from-brand-400 to-fuchsia-500 rounded-full opacity-70 blur group-hover:opacity-100 transition duration-500"></div>
                    <img src={getOptimizedImageUrl(user.avatar, { width: 220, height: 220, crop: 'thumb' })} alt={user.name} referrerPolicy="no-referrer" className="relative w-22 h-22 md:w-28 md:h-28 rounded-full border-2 border-white shadow-lg object-cover bg-slate-100" />
                    {user.verified && (
                        <div className="absolute bottom-1 right-1 bg-brand-500 text-white p-1 rounded-full border-2 border-white shadow-sm" title="Verified User">
                            <Icon name="check" size={12} />
                        </div>
                    )}
                </div>

                {/* User Info */}
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5 animate-fade-in">
                        <h1 className="text-xl md:text-3xl font-bold text-slate-900 tracking-tight font-display">{user.name}</h1>
                        <button onClick={handleShare} className="p-1 text-slate-400 hover:text-brand-600 bg-slate-100 hover:bg-brand-50 rounded-full transition-colors" title="Share Profile">
                           <Icon name="send" size={14} />
                        </button>
                    </div>

                    {/* Account Type & Role Indicator Badges */}
                    <div className="flex flex-wrap gap-1.5 mb-2.5">
                        {(user.role === 'Agent' || user.role === 'Admin') ? (
                          <>
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-indigo-600 text-white shadow-sm ring-1 ring-indigo-500/15">
                              <Icon name="building" size={11} />
                              Vendor / Seller Profile
                            </span>
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-100 shadow-sm">
                              <Icon name="check" size={11} className="text-emerald-500" />
                              Buyer & Renter Dashboard Active
                            </span>
                            {isMe && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                                <Icon name="zap" size={10} className="text-amber-500 animate-pulse" />
                                Logged in as Vendor
                              </span>
                            )}
                          </>
                        ) : (
                          <>
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-50 text-blue-700 border border-blue-100 shadow-sm">
                              <Icon name="user" size={11} className="text-blue-500" />
                              Buyer & Tenant Profile
                            </span>
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-slate-50 text-slate-600 border border-slate-150">
                              <Icon name="activity" size={11} className="text-slate-400" />
                              Renter Access Active
                            </span>
                            {isMe && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800">
                                <Icon name="check" size={10} className="text-blue-600" />
                                Logged in as Buyer
                              </span>
                            )}
                          </>
                        )}
                    </div>
                    
                    {user.role === 'Agent' && user.agencyName && (
                        <div className="flex items-center gap-1.5 text-indigo-700 text-xs font-black mb-1.5 bg-indigo-50 px-2.5 py-1 rounded-lg border border-indigo-100 inline-block">
                            <Icon name="building" size={13} className="text-indigo-600" />
                            <span>{user.agencyName}</span>
                        </div>
                    )}
                    
                    <p className="text-slate-600 text-xs md:text-sm mb-3 max-w-2xl leading-relaxed">{user.bio}</p>

                    {/* Vendor Business Details Block */}
                    {(user.role === 'Agent' || user.role === 'Admin') && (
                      <div className="mt-3.5 mb-2.5 p-3.5 rounded-2xl bg-slate-50/75 border border-slate-100 shadow-sm w-full animate-fade-in">
                        <div className="flex items-center gap-1.5 mb-2 border-b border-slate-100 pb-1.5">
                          <Icon name="building" size={13} className="text-brand-600" />
                          <h3 className="text-[11px] font-extrabold text-slate-500 uppercase tracking-wider">
                            Business Details & Contact Information
                          </h3>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                          {/* Business Display Name */}
                          <div className="flex items-start gap-2">
                            <span className="p-1 rounded-lg bg-indigo-50 text-indigo-600 mt-0.5 flex items-center justify-center"><Icon name="building" size={13} /></span>
                            <div>
                              <p className="text-slate-400 text-[9px] font-bold uppercase tracking-wider">Business Display Name</p>
                              <p className="font-extrabold text-slate-800 text-xs md:text-sm">{user.agencyName || user.name || 'Independent Vendor'}</p>
                            </div>
                          </div>

                          {/* Email */}
                          <div className="flex items-start gap-2">
                            <span className="p-1 rounded-lg bg-teal-50 text-teal-600 mt-0.5 flex items-center justify-center"><Icon name="mail" size={13} /></span>
                            <div>
                              <p className="text-slate-400 text-[9px] font-bold uppercase tracking-wider">Business Email</p>
                              {user.socials?.email || user.email ? (
                                <a href={`mailto:${user.socials?.email || user.email}`} className="font-bold text-brand-600 hover:underline">{user.socials?.email || user.email}</a>
                              ) : (
                                <p className="text-slate-400 text-[11px] italic font-medium">No business email listed</p>
                              )}
                            </div>
                          </div>

                          {/* Website */}
                          <div className="flex items-start gap-2">
                            <span className="p-1 rounded-lg bg-purple-50 text-purple-600 mt-0.5 flex items-center justify-center"><Icon name="globe" size={13} /></span>
                            <div>
                              <p className="text-slate-400 text-[9px] font-bold uppercase tracking-wider">Business Website</p>
                              {user.socials?.website ? (
                                <a href={user.socials.website.startsWith('http') ? user.socials.website : `https://${user.socials.website}`} target="_blank" rel="noopener noreferrer" className="font-bold text-brand-600 hover:underline truncate block max-w-[200px]">{user.socials.website}</a>
                              ) : (
                                <p className="text-slate-400 text-[11px] italic font-medium">No website listed</p>
                              )}
                            </div>
                          </div>

                          {/* Phone */}
                          <div className="flex items-start gap-2">
                            <span className="p-1 rounded-lg bg-blue-50 text-blue-600 mt-0.5 flex items-center justify-center"><Icon name="phone" size={13} /></span>
                            <div>
                              <p className="text-slate-400 text-[9px] font-bold uppercase tracking-wider">Business Phone</p>
                              {user.socials?.phone || user.socials?.whatsapp ? (
                                <a href={`tel:${user.socials?.phone || user.socials?.whatsapp}`} className="font-extrabold text-slate-800 hover:underline">{user.socials?.phone || user.socials?.whatsapp}</a>
                              ) : (
                                <p className="text-slate-400 text-[11px] italic font-medium">No contact phone listed</p>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                    
                    <div className="flex flex-wrap gap-2 md:gap-4 text-[11px] md:text-xs text-slate-500">
                        <div className="flex items-center gap-1.5 bg-slate-50 px-2 py-1 rounded-lg border border-slate-100">
                            <Icon name="mapPin" size={14} className="text-brand-500" />
                            {user.location}
                        </div>
                        <div className="flex items-center gap-1.5 bg-slate-50 px-2 py-1 rounded-lg border border-slate-100">
                            <Icon name="star" size={14} className="text-yellow-500" />
                            <span className="font-bold text-slate-900">{user.rating}</span> 
                            <span>({user.reviewCount} Reviews)</span>
                        </div>
                        <div className="flex items-center gap-1.5 bg-slate-50 px-2 py-1 rounded-lg border border-slate-100">
                             <Icon name="activity" size={14} className="text-brand-500" />
                             Member since {new Date(user.memberSince).toLocaleDateString('en-US', {
                               month: 'long', year: 'numeric'
                             })}
                        </div>
                    </div>
                </div>

                {/* Actions */}
                <div className="flex flex-col gap-2 w-full lg:w-auto mt-2 lg:mt-0">
                   <div className="flex gap-2">
                      {isMe ? (
                        <>
                          <Link to="/settings" className="flex-1 lg:flex-none bg-brand-600 text-white px-4 py-2 rounded-xl hover:bg-brand-700 hover:shadow-md transition-all flex items-center justify-center gap-1.5 font-bold shadow-sm text-xs">
                             <Icon name="settings" size={16} /> Edit Profile
                          </Link>
                          <button 
                            onClick={async () => {
                              await logout();
                              window.location.href = '/';
                            }}
                            className="flex-1 lg:flex-none bg-red-50 text-red-600 px-4 py-2 rounded-xl hover:bg-red-100 hover:shadow-md transition-all flex items-center justify-center gap-1.5 font-bold shadow-sm text-xs"
                          >
                            <Icon name="logout" size={16} /> Logout
                          </button>
                        </>
                      ) : (
                        <>
                          {user.socials?.whatsapp && (
                              <a href={`https://wa.me/${user.socials.whatsapp}`} target="_blank" rel="noopener noreferrer" className="flex-1 lg:flex-none bg-[#25D366] text-white px-4 py-2 rounded-xl hover:bg-[#128C7E] hover:shadow-md transition-all flex items-center justify-center gap-1.5 font-bold shadow-sm text-xs">
                                 <Icon name="whatsapp" size={16} /> Chat
                              </a>
                          )}
                          <Link to={`/chat?to=${user.id}`} className="flex-1 lg:flex-none bg-slate-900 text-white px-4 py-2 rounded-xl hover:bg-slate-800 hover:shadow-md transition-all flex items-center justify-center gap-1.5 font-bold shadow-sm text-xs">
                              <Icon name="messageCircle" size={16} /> Message
                          </Link>
                        </>
                      )}
                   </div>
                   
                   {/* Social Row */}
                   <div className="flex justify-center lg:justify-end gap-1.5">
                      {user.socials?.facebook && <a href={`https://facebook.com/${user.socials.facebook}`} target="_blank" rel="noreferrer" className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 hover:bg-[#1877F2] hover:text-white transition-all"><Icon name="facebook" size={14} /></a>}
                      {user.socials?.instagram && <a href={`https://instagram.com/${user.socials.instagram}`} target="_blank" rel="noreferrer" className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 hover:bg-gradient-to-tr hover:from-yellow-400 hover:via-red-500 hover:to-purple-500 hover:text-white transition-all"><Icon name="instagram" size={14} /></a>}
                      {user.socials?.twitter && <a href={`https://twitter.com/${user.socials.twitter}`} target="_blank" rel="noreferrer" className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 hover:bg-[#1DA1F2] hover:text-white transition-all"><Icon name="twitter" size={14} /></a>}
                      {user.socials?.linkedin && <a href="#" className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 hover:bg-[#0A66C2] hover:text-white transition-all"><Icon name="linkedin" size={14} /></a>}
                   </div>
                </div>
            </div>

            {/* Content Tabs */}
            <div className="border-b border-slate-200 mb-4 overflow-x-auto no-scrollbar">
                <div className="flex gap-4 whitespace-nowrap">
                    {user.role === 'Tenant' && isMe ? (
                      <button 
                         onClick={() => setActiveTab('saved')}
                         className={`pb-2 px-1 font-bold text-xs uppercase tracking-wider transition-all border-b-2 ${activeTab === 'saved' ? 'border-brand-600 text-brand-600' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
                      >
                          Saved Properties ({savedListings.length})
                      </button>
                    ) : null}
                    
                    {(user.role === 'Agent' || user.role === 'Admin') && (
                      <button 
                         onClick={() => setActiveTab('listings')}
                         className={`pb-2 px-1 font-bold text-xs uppercase tracking-wider transition-all border-b-2 ${activeTab === 'listings' ? 'border-brand-600 text-brand-600' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
                      >
                          Properties ({listings.length})
                      </button>
                    )}
                    {user.role === 'Agent' && isMe ? (
                      <button 
                         onClick={() => setActiveTab('pro')}
                         className={`pb-2 px-1 font-bold text-xs uppercase tracking-wider transition-all border-b-2 ${activeTab === 'pro' ? 'border-brand-600 text-brand-600' : 'border-transparent text-slate-400 hover:text-slate-600'} flex items-center gap-1`}
                      >
                          <Icon name="zap" size={13} className={activeTab === 'pro' ? 'text-brand-500' : 'text-slate-400'} /> Agent Pro
                      </button>
                    ) : null}
                    {isMe ? (
                      <button 
                         onClick={() => setActiveTab('inbox')}
                         className={`pb-2 px-1 font-bold text-xs uppercase tracking-wider transition-all border-b-2 ${activeTab === 'inbox' ? 'border-brand-600 text-brand-600' : 'border-transparent text-slate-400 hover:text-slate-600'} flex items-center gap-1`}
                      >
                          <Icon name="mail" size={13} className={activeTab === 'inbox' ? 'text-brand-500' : 'text-slate-400'} /> Simulated Inbox
                      </button>
                    ) : null}
                    <button 
                       onClick={() => setActiveTab('reviews')}
                       className={`pb-2 px-1 font-bold text-xs uppercase tracking-wider transition-all border-b-2 ${activeTab === 'reviews' ? 'border-brand-600 text-brand-600' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
                    >
                        Reviews ({user.reviewCount})
                    </button>
                </div>
            </div>

            {activeTab === 'listings' ? (
                listings.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6">
                        {mixedContent.map((item, idx) => (
                            item.type === 'listing' ? (
                                <ListingCard key={item.data.id} listing={item.data} />
                            ) : (
                                <AdCard 
                                    key={`ad-${idx}`} 
                                    type={item.data.type}
                                    title={item.data.title}
                                    description={item.data.description}
                                    cta={item.data.cta}
                                    image={item.data.image}
                                    color={item.data.color}
                                    className={`col-start-1 sm:col-start-${(idx % 2) + 1} lg:col-start-${(idx % 3) + 1} xl:col-start-${(idx % 4) + 1}`}
                                />
                            )
                        ))}
                    </div>
                ) : (
                    <div className="py-20 text-center">
                        <div className="inline-block p-6 bg-slate-50 rounded-full mb-4">
                            <Icon name="home" size={40} className="text-slate-300" />
                        </div>
                        <h3 className="text-lg font-bold text-slate-700">No properties listed</h3>
                        <p className="text-slate-500 mt-1">This agent hasn't posted any properties yet.</p>
                    </div>
                )
            ) : activeTab === 'pro' ? (
                 <AgentMonetizationDash />
            ) : activeTab === 'saved' ? (
                savedListings.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6">
                        {savedListings.map(listing => (
                            <ListingCard key={listing.id} listing={listing} />
                        ))}
                    </div>
                ) : (
                    <div className="py-20 text-center">
                        <div className="inline-block p-6 bg-slate-50 rounded-full mb-4">
                            <Icon name="heart" size={40} className="text-slate-300" />
                        </div>
                        <h3 className="text-lg font-bold text-slate-700">No saved properties</h3>
                        <p className="text-slate-500 mt-1">You haven't saved any listings to your favorites yet.</p>
                    </div>
                )
            ) : activeTab === 'inbox' ? (
                <SimulatedInbox />
            ) : (
                <div className="space-y-8">
                    {!isMe && currentUser && (
                        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                            {!showReviewForm ? (
                                <div className="flex items-center justify-between">
                                    <div>
                                        <h3 className="font-bold text-slate-800">Leave a Review</h3>
                                        <p className="text-sm text-slate-500">Share your experience with {user.name}</p>
                                    </div>
                                    <button 
                                        onClick={() => setShowReviewForm(true)}
                                        className="px-4 py-2 bg-brand-50 text-brand-600 font-medium rounded-xl hover:bg-brand-100 transition-colors"
                                    >
                                        Write Review
                                    </button>
                                </div>
                            ) : (
                                <form onSubmit={handleSubmitReview} className="space-y-4 animate-fade-in">
                                    <div className="flex items-center justify-between mb-2">
                                        <h3 className="font-bold text-slate-800">Write a Review</h3>
                                        <button 
                                            type="button" 
                                            onClick={() => setShowReviewForm(false)}
                                            className="text-slate-400 hover:text-slate-600"
                                        >
                                            <Icon name="x" size={20} />
                                        </button>
                                    </div>
                                    
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-2">Rating</label>
                                        <div className="flex gap-2">
                                            {[1, 2, 3, 4, 5].map((star) => (
                                                <button
                                                    key={star}
                                                    type="button"
                                                    onClick={() => setReviewRating(star)}
                                                    className={`p-1 transition-colors ${reviewRating >= star ? 'text-yellow-400' : 'text-slate-200 hover:text-yellow-200'}`}
                                                >
                                                    <Icon name="star" size={32} className={reviewRating >= star ? 'fill-current' : ''} />
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                    
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-2">Comment (Optional)</label>
                                        <textarea
                                            value={reviewComment}
                                            onChange={(e) => setReviewComment(e.target.value)}
                                            placeholder="Tell others about your experience..."
                                            className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-brand-500 focus:ring-2 focus:ring-brand-200 outline-none transition-all resize-none h-24"
                                            maxLength={1000}
                                        />
                                    </div>
                                    
                                    <div className="flex justify-end gap-3 pt-2">
                                        <button 
                                            type="button"
                                            onClick={() => setShowReviewForm(false)}
                                            className="px-5 py-2.5 text-slate-600 font-medium hover:bg-slate-50 rounded-xl transition-colors"
                                        >
                                            Cancel
                                        </button>
                                        <button 
                                            type="submit"
                                            disabled={isSubmittingReview}
                                            className="px-5 py-2.5 bg-brand-600 text-white font-medium rounded-xl hover:bg-brand-700 transition-colors disabled:opacity-50 flex items-center gap-2"
                                        >
                                            {isSubmittingReview ? (
                                                <><Icon name="loader" size={16} className="animate-spin" /> Submitting...</>
                                            ) : (
                                                'Submit Review'
                                            )}
                                        </button>
                                    </div>
                                </form>
                            )}
                        </div>
                    )}

                    {reviews.length > 0 ? (
                        <div className="space-y-4">
                            {reviews.map((review) => (
                                <div key={review.id} className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
                                    <div className="flex items-start justify-between mb-3">
                                        <div className="flex items-center gap-1 text-yellow-500">
                                            {[...Array(5)].map((_, i) => (
                                                <Icon 
                                                    key={i} 
                                                    name="star" 
                                                    size={16} 
                                                    className={i < review.rating ? 'fill-current' : 'text-slate-200'} 
                                                />
                                            ))}
                                        </div>
                                        <span className="text-xs text-slate-400">
                                            {new Date(review.createdAt).toLocaleDateString()}
                                        </span>
                                    </div>
                                    {review.comment && (
                                        <p className="text-slate-600 leading-relaxed">{review.comment}</p>
                                    )}
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="py-16 text-center text-slate-500 bg-slate-50/50 rounded-3xl border border-dashed border-slate-200">
                            <div className="inline-block p-4 bg-white rounded-full mb-4 shadow-sm">
                                <Icon name="star" size={32} className="text-slate-300" />
                            </div>
                            <h3 className="text-lg font-bold text-slate-700">No reviews yet</h3>
                            <p className="text-slate-500 mt-1">
                                {isMe ? "You don't have any reviews yet." : "Be the first to review this user!"}
                            </p>
                        </div>
                    )}
                </div>
            )}
        </div>
      </div>
    </div>
  );
};

export default Profile;