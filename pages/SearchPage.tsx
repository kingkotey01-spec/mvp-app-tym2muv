
import React, { useState, useEffect, useMemo } from 'react';
import { useLocation, Link, useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import ListingCard from '../components/ListingCard';
import AdCard from '../components/AdCard';
import { getListings, getMonetizationAds, getRecentViewRequestCounts } from '../services/supabaseService';
import Icon from '../components/Icon';
import { useLocation as useAppLocation } from '../context/LocationContext';
import { useMixedContent } from '../hooks/useMixedContent';
import ErrorBanner from '../components/ErrorBanner';
import SkeletonCard from '../components/SkeletonCard';
import EmptyState from '../components/EmptyState';
import useDebounce from '../hooks/useDebounce';
import { getCountryByCode } from '../services/location';

// Responsive Items limit to cover exactly 8 rows of listings in any screen size
const getResponsiveLimit = () => {
  if (typeof window === 'undefined') return 24;
  const w = window.innerWidth;
  if (w >= 1024) return 48; // lg has 6 columns, 6 * 8 = 48 items
  if (w >= 768) return 40;  // md has 5 columns, 5 * 8 = 40 items
  if (w >= 640) return 32;  // sm has 4 columns, 4 * 8 = 32 items
  return 24;                // mobile has 2-3 columns
};

const SearchPage: React.FC = () => {
  const { location: userLocation } = useAppLocation();
  const location = useLocation();
  const navigate = useNavigate();
  const searchParams = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const query = searchParams.get('q') || '';
  
  // Dynamic Items per page calculation
  const [itemsPerPage, setItemsPerPage] = useState(getResponsiveLimit);

  useEffect(() => {
    const handleResize = () => {
      setItemsPerPage(getResponsiveLimit());
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  
  // Data State
  const [listings, setListings] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [totalItems, setTotalItems] = useState(0);
  const [page, setPage] = useState(1);
  const [dbAds, setDbAds] = useState<any[]>([]);
  const [recentViewRequests, setRecentViewRequests] = useState<Record<string, number>>({});

  useEffect(() => {
    const fetchRecentCounts = async () => {
      try {
        const counts = await getRecentViewRequestCounts();
        setRecentViewRequests(counts);
      } catch (err) {
        console.error('Failed to load recent view request counts:', err);
      }
    };
    fetchRecentCounts();
  }, []);

  useEffect(() => {
    const fetchDbAds = async () => {
      try {
        const activeAds = await getMonetizationAds(userLocation.countryCode);
        const activeOnly = (activeAds || []).filter((ad: any) => ad.active);
        setDbAds(activeOnly);
      } catch (err) {
        console.warn('Failed to fetch active monetization campaigns:', err);
      }
    };
    fetchDbAds();
  }, [userLocation.countryCode]);

  const [localFilters, setLocalFilters] = useState({
    priceRange: searchParams.get('minPrice') ? (searchParams.get('maxPrice') ? `${userLocation.symbol || '$'}${searchParams.get('minPrice')} - ${userLocation.symbol || '$'}${searchParams.get('maxPrice')}` : `${userLocation.symbol || '$'}10,000+`) : 'Price Range',
    bedrooms: searchParams.get('bedrooms') ? `${searchParams.get('bedrooms')}+ Beds` : 'Beds',
    bathrooms: searchParams.get('bathrooms') ? `${searchParams.get('bathrooms')}+ Baths` : 'Baths',
    propertyType: searchParams.get('propertyType') || 'Property Type'
  });

  const debouncedFilters = useDebounce(localFilters, 500);

  const activeFilters = useMemo(() => {
    const list: { key: string; label: string; value: string }[] = [];
    const minPrice = searchParams.get('minPrice');
    const maxPrice = searchParams.get('maxPrice');
    const bedrooms = searchParams.get('bedrooms');
    const bathrooms = searchParams.get('bathrooms');
    const propertyType = searchParams.get('propertyType');
    const locationVal = searchParams.get('location');
    const categoryId = searchParams.get('categoryId');

    const symbol = userLocation.symbol || '$';

    if (minPrice || maxPrice) {
      if (minPrice && maxPrice) {
        list.push({ key: 'price', label: 'Price', value: `${symbol}${parseInt(minPrice).toLocaleString()} - ${symbol}${parseInt(maxPrice).toLocaleString()}` });
      } else if (minPrice) {
        list.push({ key: 'price', label: 'Price', value: `${symbol}${parseInt(minPrice).toLocaleString()}+` });
      } else if (maxPrice) {
        list.push({ key: 'price', label: 'Price', value: `Up to ${symbol}${parseInt(maxPrice).toLocaleString()}` });
      }
    }
    if (bedrooms) {
      list.push({ key: 'bedrooms', label: 'Bedrooms', value: `${bedrooms}+ Beds` });
    }
    if (bathrooms) {
      list.push({ key: 'bathrooms', label: 'Bathrooms', value: `${bathrooms}+ Baths` });
    }
    if (propertyType) {
      list.push({ key: 'propertyType', label: 'Property Type', value: propertyType });
    }
    if (locationVal) {
      list.push({ key: 'location', label: 'Location', value: locationVal });
    }
    if (categoryId) {
      const catObj = {
        'houses': 'Houses & Apartments',
        'land': 'Lands & Plots',
        'offices': 'Offices & Shops',
        'warehouses': 'Warehouses & Storage'
      }[categoryId] || categoryId;
      list.push({ key: 'categoryId', label: 'Category', value: catObj });
    }
    return list;
  }, [searchParams, userLocation]);

  useEffect(() => {
    // Sync debounced filters to URL
    const params = new URLSearchParams(location.search);
    let changed = false;
    
    // Bedrooms
    if (debouncedFilters.bedrooms && debouncedFilters.bedrooms !== 'Beds') {
      const val = debouncedFilters.bedrooms.replace('+', '').replace(' Beds', '');
      if (params.get('bedrooms') !== val) { params.set('bedrooms', val); changed = true; }
    } else if (params.has('bedrooms')) {
      params.delete('bedrooms'); changed = true;
    }
    
    // Bathrooms
    if (debouncedFilters.bathrooms && debouncedFilters.bathrooms !== 'Baths') {
      const val = debouncedFilters.bathrooms.replace('+', '').replace(' Baths', '');
      if (params.get('bathrooms') !== val) { params.set('bathrooms', val); changed = true; }
    } else if (params.has('bathrooms')) {
      params.delete('bathrooms'); changed = true;
    }

    // Property Type
    if (debouncedFilters.propertyType && debouncedFilters.propertyType !== 'Property Type') {
      if (params.get('propertyType') !== debouncedFilters.propertyType) { 
        params.set('propertyType', debouncedFilters.propertyType); 
        changed = true; 
      }
    } else if (params.has('propertyType')) {
      params.delete('propertyType'); changed = true;
    }

    // Price Range
    if (debouncedFilters.priceRange && debouncedFilters.priceRange !== 'Price Range') {
      const sym = userLocation.symbol || '$';
      if (debouncedFilters.priceRange === `${sym}10,000+` || debouncedFilters.priceRange === '$10,000+') {
         if (params.get('minPrice') !== '10000' || params.has('maxPrice')) {
           params.set('minPrice', '10000');
           params.delete('maxPrice');
           changed = true;
         }
      } else {
         const cleanString = debouncedFilters.priceRange.replace(/[^0-9\s-]/g, '');
         const parts = cleanString.trim().split(/\s*-\s*/);
         if (parts.length === 2 && (params.get('minPrice') !== parts[0] || params.get('maxPrice') !== parts[1])) {
            params.set('minPrice', parts[0]);
            params.set('maxPrice', parts[1]);
            changed = true;
         }
      }
    } else if (params.has('minPrice') || params.has('maxPrice')) {
      params.delete('minPrice');
      params.delete('maxPrice');
      changed = true;
    }

    if (query && !params.has('location') && !['real-estate', 'jobs', 'vehicles', 'services'].includes(query.toLowerCase())) {
        if (params.get('location') !== query) {
            params.set('location', query);
            changed = true;
        }
    }

    if (changed) {
      navigate(`/search?${params.toString()}`, { replace: true });
    }
  }, [debouncedFilters, navigate, location.search, query, userLocation]);

  const handleFilterChange = (field: keyof typeof localFilters, value: string) => {
    setLocalFilters(prev => ({ ...prev, [field]: value }));
  };

  // Define country-specific ads
  const ads = useMemo(() => {
    if (dbAds && dbAds.length > 0) {
      return dbAds.map((ad: any) => ({
        id: ad.id,
        type: ad.type === 'tall' ? 'tall' as const : 'standard' as const,
        title: ad.title,
        description: ad.description,
        cta: ad.cta || 'Learn More',
        image: ad.image,
        color: ad.color || 'from-brand-600 to-indigo-600',
        link: ad.link
      }));
    }

    const countryName = userLocation.country;
    return [
      {
        id: 'fallback-1',
        type: 'tall' as const,
        title: `Real Estate in ${countryName}`,
        description: `Explore the best properties across ${countryName}. From luxury villas to affordable apartments.`,
        cta: 'Explore Now',
        image: `https://picsum.photos/seed/${userLocation.countryCode}1/400/800`,
        color: 'from-brand-600 to-indigo-600'
      },
      {
        id: 'fallback-2',
        type: 'tall' as const,
        title: `${userLocation.currency} Mortgage Deals`,
        description: `Get the best mortgage rates in ${userLocation.country} today.`,
        cta: 'Check Rates',
        image: `https://picsum.photos/seed/${userLocation.countryCode}2/400/800`,
        color: 'from-emerald-600 to-teal-600'
      }
    ];
  }, [userLocation, dbAds]);

  // Mix listings and ads
  const mixedContent = useMixedContent(listings, ads, 10, 10, false);

  const [error, setError] = useState<string | null>(null);
  const [retryKey, setRetryKey] = useState(0);

  // Reset and load initial batch when query or country changes
  useEffect(() => {
    const fetchInitialListings = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const initialFilters: any = {
          page: 1,
          limit: itemsPerPage,
          countryCode: userLocation.countryCode,
        };

        if (query) {
          // If query looks like a category id, use it, else use search term (location for simplicity)
          if (['real-estate', 'jobs', 'vehicles', 'services'].includes(query.toLowerCase())) {
            initialFilters.categoryId = query;
          } else {
             initialFilters.location = query; // Simple search proxy
          }
        }
        
        // Take extra parameters from URL if using Smart Search Input
        if (searchParams.has('location')) initialFilters.location = searchParams.get('location');
        if (searchParams.has('categoryId')) initialFilters.categoryId = searchParams.get('categoryId');
        if (searchParams.has('propertyType')) initialFilters.propertyType = searchParams.get('propertyType');
        if (searchParams.has('minPrice')) initialFilters.minPrice = searchParams.get('minPrice');
        if (searchParams.has('maxPrice')) initialFilters.maxPrice = searchParams.get('maxPrice');
        if (searchParams.has('bedrooms')) initialFilters.bedrooms = searchParams.get('bedrooms');
        if (searchParams.has('bathrooms')) initialFilters.bathrooms = searchParams.get('bathrooms');

        const { listings: fetchedListings, total } = await getListings(initialFilters);
        const sortedListings = [...fetchedListings].sort((a, b) => {
          const aPremium = a.isPremium ? 1 : 0;
          const bPremium = b.isPremium ? 1 : 0;
          if (bPremium !== aPremium) return bPremium - aPremium;
          return new Date(b.datePosted).getTime() - new Date(a.datePosted).getTime();
        });
        setListings(sortedListings);
        setTotalItems(total);
        setPage(1);
      } catch (err) {
        console.error("Error fetching search results:", err);
        setError('Failed to load listings. Please check your connection.');
      } finally {
        setIsLoading(false);
      }
    };

    fetchInitialListings();
  }, [query, userLocation.countryCode, location.search, retryKey]);

  const handleLoadMore = async () => {
    if (isLoading || listings.length >= totalItems) return;
    
    setIsLoading(true);
    try {
      const nextPage = page + 1;
      const nextFilters: any = {
        page: nextPage,
        limit: itemsPerPage,
        countryCode: userLocation.countryCode,
      };
      if (searchParams.has('location')) nextFilters.location = searchParams.get('location');
      if (searchParams.has('categoryId')) nextFilters.categoryId = searchParams.get('categoryId');
      if (searchParams.has('propertyType')) nextFilters.propertyType = searchParams.get('propertyType');
      if (searchParams.has('minPrice')) nextFilters.minPrice = searchParams.get('minPrice');
      if (searchParams.has('maxPrice')) nextFilters.maxPrice = searchParams.get('maxPrice');
      if (searchParams.has('bedrooms')) nextFilters.bedrooms = searchParams.get('bedrooms');
      if (searchParams.has('bathrooms')) nextFilters.bathrooms = searchParams.get('bathrooms');

      const { listings: nextBatch } = await getListings(nextFilters);
      setListings(prev => {
        const merged = [...prev, ...nextBatch];
        return merged.sort((a, b) => {
          const aPremium = a.isPremium ? 1 : 0;
          const bPremium = b.isPremium ? 1 : 0;
          if (bPremium !== aPremium) return bPremium - aPremium;
          return new Date(b.datePosted).getTime() - new Date(a.datePosted).getTime();
        });
      });
      setPage(nextPage);
    } catch (error) {
      console.error("Error loading more listings:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const displayListings = listings; 

  const pageTitle = query 
    ? `Properties for "${query}" | Tym2muv Property Finder` 
    : "Discover Properties | Tym2muv Real Estate Portal";
  const pageDescription = query
    ? `Explore our premium listings matching "${query}". Verified apartments, houses, office spaces, and lands ready for purchase or rental.`
    : "Browse verified, high-quality residential, commercial, and land properties for sale or rent across Ghana on Tym2muv.";

  return (
    <div className="bg-brand-50 min-h-screen pb-8 pt-4">
      <Helmet>
        <title>{pageTitle}</title>
        <meta name="description" content={pageDescription} />
        <meta property="og:title" content={pageTitle} />
        <meta property="og:description" content={pageDescription} />
        <meta property="og:type" content="website" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={pageTitle} />
        <meta name="twitter:description" content={pageDescription} />
      </Helmet>
      
      <div className="container mx-auto px-4">
        {/* Active Filters Bar */}
        {activeFilters.length > 0 && (
          <div className="mb-6 bg-white border border-slate-100 p-4 rounded-3xl shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4 animate-fade-in relative overflow-hidden">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[11px] font-extrabold text-slate-400 uppercase tracking-widest flex items-center gap-1.5 mr-2">
                <Icon name="filter" size={14} className="text-brand-600" />
                <span>Filters ({activeFilters.length})</span>
              </span>
              <div className="flex flex-wrap items-center gap-1.5">
                {activeFilters.map(filter => (
                  <div 
                    key={filter.key} 
                    className="inline-flex items-center gap-1.5 bg-brand-50/70 border border-brand-100 hover:border-brand-200 transition-colors pl-3 pr-2 py-1 rounded-2xl text-xs font-semibold text-brand-700"
                  >
                    <span>{filter.label}:</span>
                    <span className="text-slate-700 font-bold">{filter.value}</span>
                    <button 
                      onClick={() => {
                        const params = new URLSearchParams(location.search);
                        if (filter.key === 'price') {
                          params.delete('minPrice');
                          params.delete('maxPrice');
                        } else {
                          params.delete(filter.key);
                        }
                        navigate(`/search?${params.toString()}`);
                      }}
                      className="w-4 h-4 rounded-full hover:bg-brand-200/50 flex items-center justify-center text-brand-500 hover:text-brand-800 transition-colors"
                      title={`Remove ${filter.label} filter`}
                    >
                      <Icon name="x" size={10} strokeWidth={3} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
            
            <button
              onClick={() => {
                setLocalFilters({
                  priceRange: 'Price Range',
                  bedrooms: 'Beds',
                  bathrooms: 'Baths',
                  propertyType: 'Property Type'
                });
                navigate('/search');
              }}
              className="px-4 py-2 bg-slate-50 border border-slate-200 text-slate-600 hover:text-red-600 hover:bg-red-50 hover:border-red-100 font-bold text-xs rounded-2xl transition-all flex items-center gap-1.5 shrink-0 self-end sm:self-auto group active:scale-95 cursor-pointer"
            >
              <Icon name="trash" size={12} className="group-hover:animate-bounce" />
              Clear all filters
            </button>
          </div>
        )}
           
         {error ? (
           <ErrorBanner message={error} onRetry={() => setRetryKey(k => k + 1)} />
        ) : isLoading && page === 1 ? (
          <div className="grid grid-cols-2 min-[420px]:grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-2 sm:gap-3">
             {Array.from({ length: 12 }).map((_, idx) => (
                <SkeletonCard key={`skeleton-${idx}`} />
             ))}
          </div>
        ) : displayListings.length === 0 ? (
          <EmptyState 
            title="No properties found" 
            message="We couldn't find any properties matching your search criteria. Try adjusting your filters or search terms."
            actionLabel="Clear Filters"
            onAction={() => navigate('/search')}
          />
        ) : (
          <div className="grid grid-flow-row-dense grid-cols-2 min-[420px]:grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-2 sm:gap-3">
             {(() => {
                let adIndex = -1;
                return mixedContent.map((item, idx) => {
                  if (item.type === 'listing') {
                    return (
                      <ListingCard key={item.data.id} listing={item.data} isHot={(recentViewRequests[item.data.id] || 0) > 5 || item.data.isFeatured || (item.data.isPremium && idx % 3 === 0)} />
                    );
                  } else {
                    adIndex++;
                    const adSeq = adIndex % 3;
                    let colSpanClass = "";
                    if (adSeq === 0) {
                      colSpanClass = "col-start-1 min-[420px]:col-start-1 sm:col-start-1 md:col-start-1 lg:col-start-1";
                    } else if (adSeq === 1) {
                      colSpanClass = "col-start-2 min-[420px]:col-start-3 sm:col-start-3 md:col-start-3 lg:col-start-3";
                    } else {
                      colSpanClass = "col-start-1 min-[420px]:col-start-1 sm:col-start-1 md:col-start-5 lg:col-start-5";
                    }

                    return (
                      <AdCard 
                        key={`ad-${idx}`} 
                        id={item.data.id}
                        type="tall"
                        title={item.data.title}
                        description={item.data.description}
                        cta={item.data.cta}
                        image={item.data.image}
                        color={item.data.color}
                        link={item.data.link}
                        className={`row-span-2 h-full ${colSpanClass}`}
                      />
                    );
                  }
                });
             })()}
          </div>
        )}
           
        {/* Load More Button */}
        <div className="mt-12 flex justify-center">
           <button 
             onClick={handleLoadMore}
             disabled={isLoading}
             className="flex items-center gap-3 px-8 py-3.5 bg-white border border-slate-200 rounded-2xl hover:bg-slate-50 text-slate-700 font-bold shadow-sm hover:shadow-md transition-all disabled:opacity-70 disabled:cursor-not-allowed group active:scale-95"
           >
             {isLoading ? (
               <>
                 <span className="w-5 h-5 border-2 border-slate-300 border-t-brand-600 rounded-full animate-spin"></span>
                 Loading more items...
               </>
             ) : (
               <>
                 Load More Results
                 <Icon name="chevronRight" size={14} className="rotate-90 group-hover:translate-y-0.5 transition-transform" />
               </>
             )}
           </button>
        </div>
      </div>
    </div>
  );
};

export default SearchPage;
