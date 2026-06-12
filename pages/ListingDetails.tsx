
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { motion, AnimatePresence } from 'framer-motion';
import { getListingById, getUserProfile, getListings, toggleSavedListing, createViewRequest, createReport } from '../services/supabaseService';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import { Listing, User } from '../types';
import Icon from '../components/Icon';
import AdCard from '../components/AdCard';
import ListingCard from '../components/ListingCard';
import { generateListingTitle } from '../utils/listingUtils';
import SafetyDisclaimer from '../components/SafetyDisclaimer';
import ErrorBanner from '../components/ErrorBanner';
import MortgageCalculator from '../components/MortgageCalculator';
import { getSymbolFromCode } from '../services/location';
import { getOptimizedImageUrl } from '../utils/imageOptimization';
import SkeletonCard from '../components/SkeletonCard';

const ListingDetails: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [listing, setListing] = useState<Listing | null>(null);
  const [isFloorPlanOpen, setIsFloorPlanOpen] = useState(false);
  const [currencyMode, setCurrencyMode] = useState<'GHS' | 'USD'>('GHS');

  useEffect(() => {
    if (listing?.currency === 'USD' || listing?.currency === 'GHS') {
      setCurrencyMode(listing.currency as 'GHS' | 'USD');
    }
  }, [listing]);

  const [exchangeRate, setExchangeRate] = useState<number>(14.5);

  useEffect(() => {
    const fetchRate = async () => {
      try {
        const cached = localStorage.getItem('ghs_usd_exchange_rate');
        const cacheTime = localStorage.getItem('ghs_usd_exchange_rate_time');
        
        // Use 12 hour cache to minimize API calls
        if (cached && cacheTime && Date.now() - Number(cacheTime) < 12 * 60 * 60 * 1000) {
          setExchangeRate(Number(cached));
          return;
        }

        const res = await fetch('https://open.er-api.com/v6/latest/USD');
        const data = await res.json();
        if (data && data.rates && data.rates.GHS) {
          const rate = data.rates.GHS;
          setExchangeRate(rate);
          localStorage.setItem('ghs_usd_exchange_rate', String(rate));
          localStorage.setItem('ghs_usd_exchange_rate_time', String(Date.now()));
        }
      } catch (err) {
        console.warn('Failed to fetch live exchange rate, using fallback of 14.5:', err);
      }
    };
    fetchRate();
  }, []);

  const displayCurrency = currencyMode;
  const displayPrice = listing 
    ? (listing.currency === 'GHS' && currencyMode === 'USD'
      ? listing.price / exchangeRate
      : (listing.currency === 'USD' && currencyMode === 'GHS'
        ? listing.price * exchangeRate
        : listing.price))
    : 0;

  const floorPlanImgUrl = listing?.floorPlanUrl || (listing?.isPremium ? 'https://images.unsplash.com/photo-1545464693-f1798a373343?auto=format&fit=crop&w=1200&q=80' : undefined);
  const [seller, setSeller] = useState<User | null>(null);
  const [similarListings, setSimilarListings] = useState<Listing[]>([]);
  const [activeImage, setActiveImage] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaved, setIsSaved] = useState(false);

  // Safety States
  const [isSafetyOpen, setIsSafetyOpen] = useState(false);
  const [isReportOpen, setIsReportOpen] = useState(false);
  const [safetyAction, setSafetyAction] = useState<(() => void) | null>(null);
  const [isDeliveryRequested, setIsDeliveryRequested] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retryKey, setRetryKey] = useState(0);
  const [requestedTime, setRequestedTime] = useState('10:00');

  const [reportReason, setReportReason] = useState('');
  const [reportDetails, setReportDetails] = useState('');

  const submitReport = async () => {
    if (!reportReason) {
      toast('Please select a reason for reporting.', 'warning');
      return;
    }
    try {
      await createReport({
        reporterId: user?.id,
        targetType: 'property',
        targetId: id || '',
        reason: reportDetails ? `${reportReason}: ${reportDetails}` : reportReason
      });
      setIsReportOpen(false);
      toast("Report submitted successfully.", 'success');
      setReportReason('');
      setReportDetails('');
    } catch (err) {
      console.error('Failed to submit report:', err);
      toast('Failed to submit report. Please try again.', 'error');
    }
  };

  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsFloorPlanOpen(false);
        setIsSafetyOpen(false);
        setIsReportOpen(false);
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, []);

  useEffect(() => {
    if (user && id && user.savedListings) {
      setIsSaved(user.savedListings.includes(id));
    }
  }, [user, id]);

  useEffect(() => {
    const fetchListingData = async () => {
      if (!id) return;
      setIsLoading(true);
      setError(null);
      try {
        const data = await getListingById(id);
        if (data) {
          setListing(data);
          
          document.title = `${data.title || 'Property'} – tym2muv`;
          let metaOgTitle = document.querySelector('meta[property="og:title"]');
          if (!metaOgTitle) {
            metaOgTitle = document.createElement('meta');
            metaOgTitle.setAttribute('property', 'og:title');
            document.head.appendChild(metaOgTitle);
          }
          metaOgTitle.setAttribute('content', `${data.title} – tym2muv`);

          let metaOgDesc = document.querySelector('meta[property="og:description"]');
          if (!metaOgDesc) {
            metaOgDesc = document.createElement('meta');
            metaOgDesc.setAttribute('property', 'og:description');
            document.head.appendChild(metaOgDesc);
          }
          metaOgDesc.setAttribute('content', `${data.location || 'Unknown Location'} - ${data.bedrooms || 0} Beds, ${data.bathrooms || 0} Baths`);

          let metaOgImage = document.querySelector('meta[property="og:image"]');
          if (!metaOgImage) {
            metaOgImage = document.createElement('meta');
            metaOgImage.setAttribute('property', 'og:image');
            document.head.appendChild(metaOgImage);
          }
          if (data.images && data.images.length > 0) {
              metaOgImage.setAttribute('content', data.images[0]);
          }

          const userData = await getUserProfile(data.sellerId);
          if (userData) setSeller(userData);

          // Fetch similar listings
          const { listings: similar } = await getListings({
            categoryId: data.categoryId,
            limit: 4,
            countryCode: data.country || 'GH'
          });
          setSimilarListings(similar.filter(l => l.id !== id));
        } else {
            setError('Listing not found');
        }
      } catch (err) {
        console.error("Error fetching listing details:", err);
        setError('Failed to load listing. Please check your connection.');
      } finally {
        setIsLoading(false);
      }
    };

    fetchListingData();
  }, [id, retryKey]);

  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 font-sans p-4">
        <ErrorBanner message={error} onRetry={() => setRetryKey(k => k + 1)} />
        <Link to="/" className="mt-4 px-6 py-3 border border-slate-200 text-slate-600 rounded-xl font-bold hover:bg-slate-100 transition-all shadow-sm">
          Back to Home
        </Link>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen container mx-auto px-4 py-8">
        <div className="w-full text-center mb-8">
          <p className="text-slate-600">Loading property details...</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
           <SkeletonCard />
           <SkeletonCard />
        </div>
      </div>
    );
  }

  if (!listing) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 font-sans">
        <div className="text-center">
          <div className="w-16 h-16 bg-slate-100 text-slate-300 rounded-full flex items-center justify-center mx-auto mb-4">
            <Icon name="alert" size={32} />
          </div>
          <h2 className="text-xl font-bold text-slate-800">Listing Not Found</h2>
          <p className="text-slate-500 mb-6">The property you're looking for might have been removed or is unavailable.</p>
          <Link to="/" className="px-6 py-3 bg-brand-600 text-white rounded-xl font-bold hover:bg-brand-700 transition-all">
            Back to Home
          </Link>
        </div>
      </div>
    );
  }

  const FALLBACK_IMAGE = 'https://images.unsplash.com/photo-1518780664697-55e3ad937233?w=800&h=600&fit=crop';
  const imagesList = listing.images && listing.images.length > 0 ? listing.images : [listing.imageUrl];
  const images = imagesList.filter(Boolean).length > 0 ? imagesList.filter(Boolean) as string[] : [FALLBACK_IMAGE];
  
  // Extract location parts
  const locationParts = (listing.location || 'Accra, GH').split(',').map(p => p.trim());
  const area = locationParts[0] || '';
  const city = locationParts[1] || '';

  const handleChat = () => {
    if (seller) {
      navigate(`/chat?to=${seller.id}&listingId=${listing.id}&source=Search`);
    } else {
      navigate('/signin');
    }
  };

  const triggerSafetyCheck = (action: () => void) => {
    setSafetyAction(() => action);
    setIsSafetyOpen(true);
  };

  const handleWhatsApp = () => {
    const phone = seller?.socials?.phone;
    if (!phone) return;
    const action = () => {
      const message = `Hi, I'm interested in your property: ${listing?.title}`;
      const url = `https://wa.me/${phone.replace(/\D/g, '')}?text=${encodeURIComponent(message)}`;
      window.open(url, '_blank');
    };
    triggerSafetyCheck(action);
  };

  const handleToggleSave = async () => {
    if (!user) {
      navigate('/signin');
      return;
    }
    if (!listing) return;
    
    // Optimistic UI update
    const previousState = isSaved;
    setIsSaved(!previousState);
    
    try {
      await toggleSavedListing(user.id, listing.id);
      // If we had a mechanism to update the AuthContext's user directly, we would do it here.
      // For now, it will sync next time auth state loads, or we can just rely on local state.
      toast(previousState ? "Removed from saved" : "Saved to favorites", 'success');
    } catch (e) {
      // Revert on failure
      setIsSaved(previousState);
    }
  };

  const handleRequestView = async () => {
    if (!user) {
      navigate('/signin');
      return;
    }
    
    setIsDeliveryRequested(true); // Can rename this state later, reusing for loading indicator for now
    
    try {
      let formattedTime = '10:00 AM';
      if (requestedTime) {
        const [hourStr, minStr] = requestedTime.split(':');
        const hour = parseInt(hourStr, 10);
        const ampm = hour >= 12 ? 'PM' : 'AM';
        const formattedHour = hour % 12 === 0 ? 12 : hour % 12;
        formattedTime = `${formattedHour}:${minStr} ${ampm}`;
      }

      await createViewRequest({
        listingId: listing.id,
        tenantId: user.id,
        agentId: listing.sellerId,
        status: 'pending',
        requestedDate: new Date().toISOString(),
        requestedTime: formattedTime,
        message: 'I would like to view this property.'
      });
      
      toast("Property view requested! The agent will contact you.", 'success');
    } catch (error) {
      console.error("Error creating view request:", error);
      toast("Failed to send request. Please try again.", 'error');
    } finally {
      setIsDeliveryRequested(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
      .then(() => {
        toast("Link copied to clipboard! 📋", 'success');
      })
      .catch((err) => {
        console.error("Failed to copy link:", err);
        toast("Failed to copy link. Please copy it from url bar.", 'warning');
      });
  };

  const handleShareListing = async () => {
    if (!listing) return;
    const url = window.location.href;
    const shareData = {
      title: listing.title || 'Property on tym2muv',
      text: `Check out this amazing property on tym2muv: ${listing.title} at ${listing.location}`,
      url: url,
    };

    if (navigator.share) {
      try {
        await navigator.share(shareData);
        toast("Shared successfully!", 'success');
      } catch (err: any) {
        if (err.name !== 'AbortError') {
          console.error("Error sharing:", err);
          copyToClipboard(url);
        }
      }
    } else {
      copyToClipboard(url);
    }
  };

  const pageTitle = listing 
    ? `${listing.title || generateListingTitle({ bedrooms: listing.bedrooms, propertyType: listing.propertyType })} | Tym2muv Premium Real Estate` 
    : "Property details | Tym2muv";
  const pageDescription = listing 
    ? `${listing.bedrooms || 0} Bed, ${listing.bathrooms || 0} Bath property located in ${listing.location || 'Ghana'}. Price: ${getSymbolFromCode(displayCurrency)}${displayPrice.toLocaleString(undefined, { maximumFractionDigits: 0 })}. ${listing.description?.substring(0, 150) || 'View verified property details, high-resolution location galleries, and virtual tours.'}`
    : "View premium real estate listings on Tym2muv Ghana.";
  const pageImage = listing && listing.images && listing.images.length > 0 
    ? listing.images[0] 
    : "https://images.unsplash.com/photo-1545464693-f1798a373343?auto=format&fit=crop&w=1200&q=80";

  return (
    <div className="min-h-screen bg-white font-sans pb-24">
      <Helmet>
        <title>{pageTitle}</title>
        <meta name="description" content={pageDescription} />
        <meta property="og:title" content={pageTitle} />
        <meta property="og:description" content={pageDescription} />
        <meta property="og:image" content={pageImage} />
        <meta property="og:type" content="article" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={pageTitle} />
        <meta name="twitter:description" content={pageDescription} />
        <meta name="twitter:image" content={pageImage} />
      </Helmet>
      {/* Header / Navigation */}
      <div className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-slate-100">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <button 
            onClick={() => navigate(-1)}
            className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-slate-100 transition-colors"
          >
            <Icon name="arrowLeft" size={20} />
          </button>
          <div className="flex items-center gap-2">
            <button 
              onClick={() => {
                const url = window.location.href;
                const text = `Check out this property on tym2muv: ${listing?.title || 'Property'} - ${url}`;
                window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
              }}
              className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-slate-100 transition-colors text-green-600 bg-green-50 hover:bg-green-100"
              title="Share on WhatsApp"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 21l1.65-3.8a9 9 0 1 1 3.4 2.9L3 21"/><path d="M9 10a.5.5 0 0 0 1 0V9a.5.5 0 0 0-1 0v1a5 5 0 0 0 5 5h1a.5.5 0 0 0 0-1h-1a.5.5 0 0 0 0 1"/></svg>
            </button>
            <button 
              onClick={handleShareListing}
              className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-slate-100 transition-colors text-brand-600 bg-brand-50 hover:bg-brand-100"
              title="Share Listing"
            >
              <Icon name="share2" size={20} />
            </button>
            <button 
              onClick={handleToggleSave}
              className={`w-10 h-10 flex items-center justify-center rounded-full transition-colors ${
                isSaved ? 'bg-red-50 text-red-500 hover:bg-red-100' : 'hover:bg-slate-100 text-slate-700'
              }`}
              title={isSaved ? "Saved to Favorites" : "Save Property"}
            >
              <Icon name="heart" size={20} className={isSaved ? "fill-red-500" : ""} />
            </button>
            <button 
              onClick={() => setIsReportOpen(true)}
              className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-slate-100 text-slate-400 hover:text-red-600 transition-colors"
              title="Report Listing"
            >
              <Icon name="alert" size={20} />
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-3 py-3 md:py-4 animate-fade-in">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 lg:gap-8 items-start">
          {/* Section 1: Column 1 */}
          <div className="space-y-4">
            {/* Column 1 Row 1 - Property Name */}
            <div className="space-y-0.5">
              <h1 className="text-lg lg:text-xl font-black text-slate-900 leading-tight font-display">
                {generateListingTitle({ 
                  bedrooms: listing.bedrooms, 
                  propertyType: listing.propertyType
                })}
              </h1>
            </div>

            {/* Column 1 Row 2 - Price */}
            <div className="py-1 border-b border-slate-100 flex items-center justify-between">
              <div className="space-y-0.5">
                <div className="text-base lg:text-lg font-black text-brand-600 flex items-baseline gap-1">
                  <span className="text-2xs font-bold">{getSymbolFromCode(displayCurrency)}</span>
                  {displayPrice.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  {listing.type === 'Rent' && <span className="text-[10px] font-medium text-slate-400">/mo</span>}
                </div>
                {listing.currency !== currencyMode && (
                  <p className="text-[8px] text-slate-400 italic">
                    Converted at 1 USD = {exchangeRate.toFixed(2)} GHS (exchange rates are approximate and parsed live)
                  </p>
                )}
                <p className="text-[8px] text-slate-450 mt-0.5 flex items-center gap-1.5">
                  <Icon name="clock" size={8} />
                  Posted {listing.datePosted}
                </p>
              </div>
              <button
                onClick={() => setCurrencyMode(prev => prev === 'GHS' ? 'USD' : 'GHS')}
                className="px-2.5 py-1 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-brand-600 text-[9px] font-black uppercase tracking-wider transition-all cursor-pointer border border-slate-200 flex items-center gap-1 shadow-2xs"
                title="Toggle Currency (GHS / USD)"
              >
                <Icon name="refreshCw" size={8} />
                <span>Format in {currencyMode === 'GHS' ? 'USD' : 'GHS'}</span>
              </button>
            </div>

            {/* Column 1 Row 2.5 - Quick Action Buttons */}
            <div className="grid grid-cols-3 gap-2.5 py-2 border-b border-slate-100">
              <button
                onClick={handleToggleSave}
                className={`py-1.5 px-2 rounded-lg text-2xs font-extrabold transition-all duration-200 flex items-center justify-center gap-1.5 border cursor-pointer hover:bg-slate-50 ${
                  isSaved 
                  ? 'bg-red-50 text-red-600 border-red-100' 
                  : 'bg-slate-50 text-slate-650 border-slate-100'
                }`}
                title={isSaved ? "Saved to Favorites" : "Save Property"}
              >
                <Icon name="heart" size={12} className={isSaved ? "fill-red-500" : ""} />
                <span>{isSaved ? 'Saved' : 'Save'}</span>
              </button>

              <button
                onClick={handleShareListing}
                className="py-1.5 px-2 bg-brand-50 text-brand-700 border border-brand-100 rounded-lg text-2xs font-extrabold hover:bg-brand-100/50 cursor-pointer transition-all duration-200 flex items-center justify-center gap-1.5"
                title="Share Listing"
              >
                <Icon name="share2" size={12} />
                <span>Share</span>
              </button>

              <button
                onClick={() => {
                  const url = window.location.href;
                  const text = `Check out this property on tym2muv: ${listing?.title || 'Property'} - ${url}`;
                  window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
                }}
                className="py-1.5 px-2 bg-emerald-50 text-emerald-700 border border-emerald-100 rounded-lg text-2xs font-extrabold hover:bg-emerald-110/30 cursor-pointer transition-all duration-200 flex items-center justify-center gap-1.5"
                title="Share via WhatsApp"
              >
                <svg className="w-3 h-3 text-emerald-600" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12.004 0C5.372 0 0 5.372 0 12c0 2.112.551 4.164 1.597 5.977l-1.6 5.85 5.992-1.569c1.758.956 3.738 1.464 5.753 1.464H12c6.627 0 12-5.373 12-12s-5.373-12-12-12zm.172 21.84c-1.899 0-3.76-.51-5.385-1.472l-.387-.23-3.559.932.951-3.468-.252-.401c-1.057-1.685-1.616-3.64-1.614-5.65.004-5.831 4.75-10.575 10.584-10.575 2.825.001 5.48 1.1 7.48 3.102 1.999 2 3.098 4.66 3.095 7.487-.005 5.832-4.75 10.575-10.567 10.575zm5.794-7.904c-.318-.16-1.88-.928-2.179-1.037-.298-.11-.516-.16-.732.16-.217.32-.838 1.037-1.026 1.256-.189.218-.378.245-.696.086-1.423-.715-2.483-1.332-3.473-3.024-.26-.445.26-.413.743-1.378.08-.16.04-.3-.02-.46-.06-.16-.516-1.256-.708-1.71-.186-.45-.37-.387-.513-.394-.132-.007-.284-.007-.436-.007s-.4.057-.61.284c-.21.228-.802.784-.802 1.91s.816 2.21 1.026 2.49c.21.28 1.625 2.48 3.935 3.48.55.237 1.062.392 1.423.506.63.2 1.203.172 1.655.105.503-.075 1.547-.632 1.765-1.214.218-.58.218-1.08.152-1.185-.065-.105-.246-.16-.563-.32z"/>
                </svg>
                <span>WhatsApp</span>
              </button>
            </div>

            {/* Column 1 Row 3 & 4 - Location */}
            <div className="grid grid-cols-2 gap-1.5">
              {/* Row 3 - Location City */}
              <div className="p-2 bg-slate-50/50 rounded-lg border border-slate-100 flex items-center gap-1.5">
                <div className="w-5 h-5 rounded bg-white flex items-center justify-center text-brand-600 shadow-xs shrink-0">
                  <Icon name="building" size={10} />
                </div>
                <div className="min-w-0">
                  <p className="text-[7px] text-slate-400 font-bold uppercase tracking-wider truncate">City</p>
                  <p className="text-[10px] font-bold text-slate-800 truncate">{city || 'N/A'}</p>
                </div>
              </div>
              {/* Row 4 - Location Area or Suburb */}
              <div className="p-2 bg-slate-50/50 rounded-lg border border-slate-100 flex items-center gap-1.5">
                <div className="w-5 h-5 rounded bg-white flex items-center justify-center text-brand-600 shadow-xs shrink-0">
                  <Icon name="mapPin" size={10} />
                </div>
                <div className="min-w-0">
                  <p className="text-[7px] text-slate-400 font-bold uppercase tracking-wider truncate">Area / Suburb</p>
                  <p className="text-[10px] font-bold text-slate-800 truncate">{area || 'N/A'}</p>
                </div>
              </div>
            </div>

            {/* Column 1 Row 5 - Description */}
            <div className="space-y-1">
              <p className="text-slate-500 text-[10px] sm:text-[11px] leading-relaxed font-sans whitespace-pre-wrap">
                {listing.description || `This stunning ${listing.propertyType.toLowerCase()} located in the heart of ${listing.location} offers a perfect blend of modern luxury and comfort.`}
              </p>
            </div>

            {/* Column 1 Row 5.5 - Property Details Grid */}
            <div className="grid grid-cols-2 gap-3 py-2 border-y border-slate-100">
               {listing.sqft && (
                 <div className="flex items-center gap-3">
                   <div className="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center text-slate-500">
                     <Icon name="map" size={16} />
                   </div>
                   <div>
                     <p className="text-[8px] text-slate-400 font-bold uppercase">Square Feet</p>
                     <p className="text-xs font-bold text-slate-800">{listing.sqft.toLocaleString()} sqft</p>
                   </div>
                 </div>
               )}
               {listing.yearBuilt && (
                 <div className="flex items-center gap-3">
                   <div className="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center text-slate-500">
                     <Icon name="calendar" size={16} />
                   </div>
                   <div>
                     <p className="text-[8px] text-slate-400 font-bold uppercase">Year Built</p>
                     <p className="text-xs font-bold text-slate-800">{listing.yearBuilt}</p>
                   </div>
                 </div>
               )}
            </div>

            {/* Column 1 Row 6 - All Amenities */}
            {listing.amenities && listing.amenities.length > 0 && (
              <div className="space-y-1.5">
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                  {listing.amenities.map((amenity, idx) => (
                    <div key={idx} className="flex items-center gap-1.5 p-1.5 rounded-md border border-slate-50 bg-white shadow-sm">
                      <div className="w-4 h-4 rounded bg-brand-50 text-brand-600 flex items-center justify-center shrink-0">
                        <Icon name="check" size={8} />
                      </div>
                      <span className="text-[9px] font-bold text-slate-600 truncate">{amenity}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Seller Card (Agent Details) */}
            <div 
              onClick={() => navigate(`/profile/${seller?.id}`)}
              className="p-3 bg-slate-50/50 rounded-xl border border-slate-100 space-y-3 cursor-pointer hover:bg-slate-100 transition-all group"
            >
              <div className="flex items-center gap-2.5">
                <div className="relative">
                  <img 
                    src={getOptimizedImageUrl(seller?.avatar, { width: 80, height: 80, crop: 'thumb' })} 
                    alt={seller?.name} 
                    className="w-10 h-10 rounded-lg object-cover border-2 border-white shadow-xs group-hover:shadow-sm"
                    referrerPolicy="no-referrer"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(seller?.name || 'User')}&background=random`;
                    }}
                  />
                  {seller?.verified && (
                    <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-brand-500 text-white rounded-full border border-white flex items-center justify-center shadow-xs">
                      <Icon name="shieldCheck" size={6} />
                    </div>
                  )}
                </div>
                <div>
                  <h3 className="text-xs font-bold text-slate-900 group-hover:text-brand-600 transition-colors">{seller?.name}</h3>
                  <p className="text-[9px] text-slate-550 font-medium">{seller?.role}</p>
                  <div className="flex items-center gap-1 mt-0.5">
                    <Icon name="star" size={8} className="text-amber-400 fill-amber-400" />
                    <span className="text-[10px] font-black text-slate-700">{seller?.rating}</span>
                  </div>
                </div>
              </div>

              <div className="pt-2 space-y-2.5 border-t border-slate-100/50" onClick={(e) => e.stopPropagation()}>
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-bold text-slate-500 block">Preferred Viewing Time</label>
                  <input
                    type="time"
                    value={requestedTime}
                    onChange={e => setRequestedTime(e.target.value)}
                    className="border border-slate-200 rounded-lg px-2.5 py-1 text-xs w-full bg-white outline-none focus:ring-1 focus:ring-brand-500 font-medium text-slate-800"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <button 
                    onClick={handleChat}
                    className="px-2 py-2 bg-slate-900 hover:bg-black text-white text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5"
                  >
                    <Icon name="messageCircle" size={14} />
                    Message
                  </button>
                  <div className="flex gap-1.5">
                    <button 
                      onClick={() => triggerSafetyCheck(() => handleRequestView())}
                      disabled={isDeliveryRequested}
                      className="flex-1 px-2 py-2 bg-brand-600 hover:bg-brand-700 disabled:bg-brand-400 text-white text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5"
                    >
                      {isDeliveryRequested ? (
                        <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      ) : (
                        <>
                          <Icon name="calendar" size={14} />
                          Book View
                        </>
                      )}
                    </button>
                    {seller?.socials?.phone && (
                      <button 
                        onClick={() => triggerSafetyCheck(() => window.location.href = `tel:${seller.socials.phone}`)}
                        className="flex-none w-10 py-2 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold rounded-lg border border-slate-200 transition-all flex items-center justify-center"
                      >
                        <Icon name="phone" size={14} />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-6">
              <MortgageCalculator price={displayPrice} currency={displayCurrency} />
            </div>
          </div>

          {/* Section 2: Column 2 */}
          <div className="space-y-4">
            {/* Column 2 Row 1 - Displayed Property Image with Tags */}
            <div className="relative aspect-[16/10] rounded-xl overflow-hidden shadow-md group">
              <AnimatePresence mode="wait">
                <motion.img 
                  key={activeImage}
                  src={getOptimizedImageUrl(images[activeImage], { width: 1200 })}
                  srcSet={`${getOptimizedImageUrl(images[activeImage], { width: 600 })} 600w, ${getOptimizedImageUrl(images[activeImage], { width: 800 })} 800w, ${getOptimizedImageUrl(images[activeImage], { width: 1200 })} 1200w`}
                  sizes="(max-width: 768px) 100vw, 50vw"
                  loading="lazy"
                  alt={listing.title} 
                  initial={{ opacity: 0, scale: 1.02 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.98 }}
                  transition={{ duration: 0.4 }}
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    target.src = FALLBACK_IMAGE;
                  }}
                />
              </AnimatePresence>
              
              {/* Tags on Image */}
              <div className="absolute top-2.5 left-2.5 flex flex-col gap-1">
                <div className="text-[7px] font-black uppercase tracking-[0.1em] text-slate-700 bg-white/95 px-2 py-0.5 rounded shadow-sm border border-slate-100">
                  For {listing.type}
                </div>
                {listing.isPremium && (
                  <div className="px-2 py-0.5 bg-amber-50 text-amber-700 rounded text-[7px] font-black uppercase tracking-[0.1em] shadow-sm flex items-center gap-1 border border-amber-100">
                    <Icon name="award" size={10} className="text-amber-600" />
                    Premium
                  </div>
                )}
                {listing.isVerified && (
                  <div className="px-2 py-0.5 bg-white/90 backdrop-blur-md text-slate-900 rounded text-[7px] font-black uppercase tracking-[0.1em] shadow-sm flex items-center gap-1 border border-white/10">
                    <Icon name="shieldCheck" size={10} className="text-brand-600" />
                    Verified
                  </div>
                )}
              </div>

              {/* Navigation Controls */}
              <div className="absolute inset-x-2.5 bottom-2.5 flex items-center justify-between">
                <div className="flex gap-1">
                  <button 
                    onClick={() => setActiveImage((prev) => (prev - 1 + images.length) % images.length)}
                    className="w-7 h-7 rounded bg-white/10 backdrop-blur-xl text-white flex items-center justify-center hover:bg-white/20 transition-all border border-white/10"
                  >
                    <Icon name="chevronRight" size={14} className="rotate-180" />
                  </button>
                  <button 
                    onClick={() => setActiveImage((prev) => (prev + 1) % images.length)}
                    className="w-7 h-7 rounded bg-white/10 backdrop-blur-xl text-white flex items-center justify-center hover:bg-white/20 transition-all border border-white/10"
                  >
                    <Icon name="chevronRight" size={14} />
                  </button>
                </div>
                <div className="px-2.5 py-1 bg-black/30 backdrop-blur-xl rounded text-white text-[7px] font-black tracking-widest border border-white/10 font-mono">
                  {activeImage + 1} / {images.length}
                </div>
              </div>
            </div>

            {/* Column 2 Row 2 - Additional Images and videos */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="text-[8px] font-black text-slate-400 uppercase tracking-[0.2em]">Gallery</h3>
                <div className="flex items-center gap-3">
                  {listing.virtualTourUrl && (
                    <a 
                      href={listing.virtualTourUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[8px] font-bold text-brand-600 flex items-center gap-1 hover:underline font-mono"
                    >
                      <Icon name="eye" size={9} />
                      Virtual Tour
                    </a>
                  )}
                  {floorPlanImgUrl && (
                    <button 
                      onClick={() => setIsFloorPlanOpen(true)}
                      className="text-[8px] font-bold text-brand-600 flex items-center gap-1 hover:underline cursor-pointer bg-transparent border-0 p-0 font-mono"
                    >
                      <Icon name="map" size={9} />
                      View Floor Plan
                    </button>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-6 gap-1.5">
                {images.map((img, idx) => (
                  <button
                    key={idx}
                    onClick={() => setActiveImage(idx)}
                    className={`relative aspect-square rounded overflow-hidden border transition-all duration-300 ${
                      activeImage === idx 
                      ? 'border-brand-500 scale-102 shadow-xs' 
                      : 'border-transparent opacity-60 hover:opacity-100'
                    }`}
                  >
                    <img 
                      src={getOptimizedImageUrl(img, { width: 120, height: 120, crop: 'fill' })} 
                      loading="lazy"
                      alt="" 
                      className="w-full h-full object-cover" 
                      referrerPolicy="no-referrer" 
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        target.src = FALLBACK_IMAGE;
                      }}
                    />
                  </button>
                ))}
                {listing.videos?.map((video, idx) => (
                  <div key={`video-${idx}`} className="relative aspect-square rounded overflow-hidden bg-slate-900 flex items-center justify-center cursor-pointer group hover:scale-102 transition-all">
                    <Icon name="play" size={16} className="text-white group-hover:scale-110 transition-transform z-10" />
                    <div className="absolute inset-0 bg-black/40 group-hover:bg-black/20 transition-all"></div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Similar Properties Section */}
      <section className="mt-8 pt-6 border-t border-slate-100 relative z-10 bg-white">
        <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg md:text-xl font-black text-slate-900 tracking-tight">Similar Properties</h2>
              <p className="text-xs text-slate-500 font-medium mt-0.5">Handpicked properties you might like in {listing.location}</p>
            </div>
            <Link to="/search" className="px-3 py-1.5 bg-slate-50 text-brand-600 text-xs font-bold rounded-lg hover:bg-brand-50 transition-all flex items-center gap-1.5">
              <span>View All</span>
              <Icon name="chevronRight" size={14} />
            </Link>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-5">
            {similarListings.map(item => (
              <ListingCard key={item.id} listing={item} />
            ))}
            {similarListings.length === 0 && (
              <div className="col-span-full py-8 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200">
                <p className="text-slate-405 text-xs font-medium">No similar properties found nearby.</p>
              </div>
            )}
          </div>
        </section>

      {/* Report Modal */}
      <AnimatePresence>
        {isReportOpen && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white max-w-md w-full rounded-[2rem] p-6 text-center shadow-2xl relative"
            >
              <button 
                onClick={() => setIsReportOpen(false)}
                className="absolute top-4 right-4 text-slate-400 hover:text-slate-600"
              >
                 <Icon name="x" size={24} />
              </button>
              <div className="w-16 h-16 bg-red-50 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
                <Icon name="alert" size={32} />
              </div>
              <h2 className="text-xl font-bold text-slate-900 mb-2">Report Listing</h2>
              <p className="text-sm text-slate-500 mb-6 px-4">
                Please let us know why you are reporting this listing.
              </p>
              
              <div className="space-y-3 mb-6 text-left">
                 {['Spam', 'Scam', 'Inappropriate content', 'Property unavailable'].map((reason) => (
                    <label 
                      key={reason} 
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          setReportReason(reason);
                        }
                      }}
                      className="flex items-center gap-3 p-3 border border-slate-100 rounded-xl cursor-pointer hover:bg-slate-50 focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 focus:outline-none"
                    >
                       <input 
                         type="radio" 
                         name="reportReason" 
                         value={reason}
                         checked={reportReason === reason}
                         onChange={(e) => setReportReason(e.target.value)}
                         tabIndex={-1}
                         className="w-4 h-4 text-red-600 focus:ring-red-500 border-gray-300"
                       />
                       <span className="text-sm font-medium text-slate-700">{reason}</span>
                    </label>
                 ))}
                 
                 <textarea
                   className="w-full mt-4 p-3 border border-slate-200 rounded-xl text-sm focus:ring-red-500 outline-none"
                   placeholder="Additional details (optional)"
                   rows={3}
                   value={reportDetails}
                   onChange={e => setReportDetails(e.target.value)}
                 ></textarea>
              </div>

              <div className="flex gap-3">
                <button 
                  onClick={() => setIsReportOpen(false)}
                  className="flex-1 py-3 text-slate-600 font-bold hover:bg-slate-50 rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button 
                  onClick={submitReport}
                  className="flex-1 py-3 bg-red-600 text-white font-bold rounded-xl hover:bg-red-700 transition-colors shadow-lg shadow-red-600/20"
                >
                  Submit Report
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Floor Plan Modal */}
      <AnimatePresence>
        {isFloorPlanOpen && floorPlanImgUrl && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsFloorPlanOpen(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-md"
            />
            
            <motion.div 
              initial={{ scale: 0.95, y: 15, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.95, y: 15, opacity: 0 }}
              transition={{ type: 'spring', damping: 25, stiffness: 350 }}
              className="bg-white rounded-2xl p-5 max-w-2xl w-full relative z-10 shadow-2xl border border-slate-100 flex flex-col items-center"
            >
              <button 
                onClick={() => setIsFloorPlanOpen(false)}
                className="absolute top-4 right-4 w-8 h-8 rounded-full bg-slate-50 hover:bg-slate-100 flex items-center justify-center text-slate-500 hover:text-slate-800 transition-colors cursor-pointer border border-slate-200 shadow-2xs"
              >
                <Icon name="x" size={16} />
              </button>
              
              <div className="w-full text-center space-y-1 mb-4">
                <div className="w-12 h-12 bg-brand-50 text-brand-600 rounded-full flex items-center justify-center mx-auto mb-2">
                  <Icon name="map" size={24} />
                </div>
                <h3 className="text-md lg:text-lg font-black text-slate-900 leading-tight font-display">
                  Property Floor Plan
                </h3>
                <p className="text-2xs text-slate-400 uppercase tracking-widest font-mono">
                  {generateListingTitle({ 
                    bedrooms: listing?.bedrooms, 
                    propertyType: listing?.propertyType
                  })}
                </p>
              </div>

              <div className="relative w-full aspect-[4/3] rounded-xl overflow-hidden bg-slate-50 border border-slate-200 flex items-center justify-center min-h-[300px]">
                <img 
                  src={floorPlanImgUrl} 
                  alt="Floor Plan" 
                  className="max-h-full max-w-full object-contain mix-blend-multiply"
                  referrerPolicy="no-referrer"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    target.src = 'https://images.unsplash.com/photo-1545464693-f1798a373343?auto=format&fit=crop&w=1200&q=80';
                  }}
                />
              </div>

              <div className="mt-4 w-full bg-slate-50 border border-slate-100 rounded-xl p-3 text-center">
                <p className="text-[10px] font-medium text-slate-500 leading-relaxed max-w-md mx-auto">
                  Disclaimer: Diagrams & layout configurations are conceptual models provided for indicative reference only. Exact measurements may vary depending on active construction options.
                </p>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Safety Disclaimer Modal */}
      <SafetyDisclaimer 
        isOpen={isSafetyOpen}
        onClose={() => setIsSafetyOpen(false)}
        onConfirm={() => {
          setIsSafetyOpen(false);
          if (safetyAction) safetyAction();
        }}
      />
    </div>
  );
};

export default ListingDetails;
