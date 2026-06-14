
import React, { useMemo, useState, useEffect, useRef } from 'react';
import { CATEGORIES } from '../constants';
import ListingCard from '../components/ListingCard';
import AdCard from '../components/AdCard';
import { getListings, getMonetizationAds } from '../services/supabaseService';
import Icon from '../components/Icon';
import { Link } from 'react-router-dom';
import { useLocation as useAppLocation } from '../context/LocationContext';
import { useMixedContent } from '../hooks/useMixedContent';
import IssueBanner from '../components/IssueBanner';
import SkeletonCard from '../components/SkeletonCard';
import SmartSearchInput from '../components/SmartSearchInput';

const ITEMS_PER_PAGE = 24; // Reduced for better performance with live data

const Home: React.FC = () => {
  const { location: userLocation } = useAppLocation();
  const [currentPage, setCurrentPage] = useState(1);
  const [listings, setListings] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAppending, setIsAppending] = useState(false);
  const [totalItems, setTotalItems] = useState(0);
  const [dbAds, setDbAds] = useState<any[]>([]);
  const totalPages = Math.ceil(totalItems / ITEMS_PER_PAGE) || 1;
  const loaderRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    setCurrentPage(1); // Reset page on country change
    setIsAppending(false);
    setError(null);
  }, [userLocation.countryCode]);

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

  const fetchListings = async () => {
    // Don't show full loading skeleton if we're just appending
    if (!isAppending) setIsLoading(true);
    setError(null);
    try {
      const { listings: fetchedListings, total } = await getListings({
        page: currentPage,
        limit: ITEMS_PER_PAGE,
        countryCode: userLocation.countryCode
      });
      
      if (isAppending) {
          setListings(prev => {
              // Avoid duplicates in case of React double rendering
              const existingIds = new Set(prev.map(l => l.id));
              const uniqueNew = fetchedListings.filter(l => !existingIds.has(l.id));
              const merged = [...prev, ...uniqueNew];
              return merged.sort((a, b) => {
                const aPremium = a.isPremium ? 1 : 0;
                const bPremium = b.isPremium ? 1 : 0;
                if (bPremium !== aPremium) return bPremium - aPremium;
                return new Date(b.datePosted).getTime() - new Date(a.datePosted).getTime();
              });
          });
      } else {
          const sorted = [...fetchedListings].sort((a, b) => {
            const aPremium = a.isPremium ? 1 : 0;
            const bPremium = b.isPremium ? 1 : 0;
            if (bPremium !== aPremium) return bPremium - aPremium;
            return new Date(b.datePosted).getTime() - new Date(a.datePosted).getTime();
          });
          setListings(sorted);
      }
      setTotalItems(total);
    } catch (err) {
      console.error("Error fetching listings:", err);
      setError('Failed to load listings. Please check your connection.');
    } finally {
      setIsLoading(false);
      setIsAppending(false);
    }
  };

  useEffect(() => {
    fetchListings();
    
    // Scroll to top of the trending section or page if NOT appending
    if (!isAppending) {
        const trendingSection = document.getElementById('trending-section');
        if (trendingSection && currentPage > 1) {
          trendingSection.scrollIntoView({ behavior: 'smooth' });
        } else if (currentPage === 1) {
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    }
  }, [currentPage, userLocation.countryCode]);

  useEffect(() => {
      const observer = new IntersectionObserver(
          (entries) => {
              if (entries[0].isIntersecting && !isLoading && currentPage < totalPages) {
                  // check if on mobile
                  if (window.innerWidth < 768) {
                      setIsAppending(true);
                      setCurrentPage(prev => prev + 1);
                  }
              }
          },
          { threshold: 0.1 }
      );
      
      if (loaderRef.current) {
          observer.observe(loaderRef.current);
      }
      
      return () => {
          if (loaderRef.current) observer.unobserve(loaderRef.current);
      };
  }, [isLoading, currentPage, totalPages]);

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
      },
      {
        id: 'fallback-3',
        type: 'tall' as const,
        title: 'Verified Agents',
        description: `Work with top-rated agents in ${countryName} for a safe transaction.`,
        cta: 'Find Agent',
        image: `https://picsum.photos/seed/${userLocation.countryCode}3/400/800`,
        color: 'from-blue-600 to-indigo-600'
      },
      {
        id: 'fallback-4',
        type: 'tall' as const,
        title: 'Post Your Ad',
        description: `Selling in ${countryName}? List your property for free and reach millions.`,
        cta: 'Post Now',
        image: `https://picsum.photos/seed/${userLocation.countryCode}4/400/800`,
        color: 'from-orange-600 to-amber-600'
      }
    ];
  }, [userLocation, dbAds]);

  // Mix listings and ads
  const mixedContent = useMixedContent(listings, ads, 16, 10, true);

  const renderPagination = () => {
    const pages = [];
    const windowStart = Math.max(1, currentPage - 1);
    const windowEnd = Math.min(totalPages, currentPage + 1);

    if (windowStart > 1) {
      pages.push(
        <button
          key={1}
          onClick={() => setCurrentPage(1)}
          className="w-10 h-10 rounded-full flex items-center justify-center font-bold transition-all bg-white text-slate-600 hover:bg-brand-50 border border-slate-200"
        >
          1
        </button>
      );
      if (windowStart > 2) {
         pages.push(<span key={"dots-1"} className="px-2 text-slate-400">...</span>);
      }
    }

    for (let i = windowStart; i <= windowEnd; i++) {
        pages.push(
            <button
                key={i}
                onClick={() => setCurrentPage(i)}
                className={`w-10 h-10 rounded-full flex items-center justify-center font-bold transition-all ${
                currentPage === i
                    ? 'bg-brand-600 text-white shadow-lg shadow-brand-600/30 scale-110'
                    : 'bg-white text-slate-600 hover:bg-brand-50 border border-slate-200'
                }`}
            >
                {i}
            </button>
        );
    }

    if (windowEnd < totalPages) {
       if (windowEnd < totalPages - 1) {
           pages.push(<span key={"dots-2"} className="px-2 text-slate-400">...</span>);
       }
       pages.push(
        <button
          key={totalPages}
          onClick={() => setCurrentPage(totalPages)}
          className="w-10 h-10 rounded-full flex items-center justify-center font-bold transition-all bg-white text-slate-600 hover:bg-brand-50 border border-slate-200"
        >
          {totalPages}
        </button>
      );
    }

    return (
      <div className="hidden md:flex items-center justify-center gap-2 mt-12">
        <button
          onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
          disabled={currentPage === 1}
          className="w-10 h-10 rounded-full flex items-center justify-center bg-white text-slate-600 border border-slate-200 disabled:opacity-50 hover:bg-brand-50 transition-all"
        >
          <Icon name="chevronRight" size={20} className="rotate-180" />
        </button>
        {pages}
        <button
          onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
          disabled={currentPage === totalPages}
          className="w-10 h-10 rounded-full flex items-center justify-center bg-white text-slate-600 border border-slate-200 disabled:opacity-50 hover:bg-brand-50 transition-all"
        >
          <Icon name="chevronRight" size={20} />
        </button>
      </div>
    );
  };

  return (
    <div className="pt-2 pb-8">
      <div className="container mx-auto px-4 max-w-7xl space-y-6 animate-slide-up relative z-10">
         
          {/* Stunning Premium Home Hero Banner */}
          <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#8607C1] to-[#3B0058] text-white p-5 md:p-8 shadow-lg shadow-[#8607C1]/10 border border-[#CF8EED]/20 mt-2">
            {/* Visual background layers & Neon glows */}
            <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-black/40 pointer-events-none"></div>
            <div className="absolute top-0 right-0 w-[200px] h-[200px] bg-[#00ffcc]/10 rounded-full blur-[80px] pointer-events-none animate-pulse"></div>
            <div className="absolute bottom-0 left-10 w-[150px] h-[150px] bg-[#ff007f]/5 rounded-full blur-[80px] pointer-events-none"></div>
            
            <div className="relative z-10 max-w-2xl flex flex-col gap-3">
              <h1 className="text-2xl md:text-3xl lg:text-4xl font-extrabold tracking-tight leading-tight md:leading-none font-wix text-white">
                Perspective Change? <span className="whitespace-nowrap">It's <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 via-[#00ffcc] to-sky-400">tym2muv.</span></span>
              </h1>
              
              <p className="text-slate-200 text-xs max-w-lg leading-relaxed font-wix font-medium">
                Stop doom scrolling apps that ghost you. Lock down your next aesthetic upgrade and drop the link to the group chat.
              </p>

              {/* Trust Badge Indicators */}
              <div className="flex flex-wrap items-center gap-3 mt-1.5 text-[10px] md:text-[11px] font-mono text-slate-300">
                <div className="flex items-center gap-1">
                  <Icon name="check" size={12} className="text-[#00ffcc]" />
                  <span>Verified listings</span>
                </div>
                <div className="w-0.5 h-0.5 bg-slate-700 rounded-full hidden sm:block"></div>
                <div className="flex items-center gap-1">
                  <Icon name="shield" size={12} className="text-[#ff007f]" />
                  <span>100% Secure Transactions</span>
                </div>
                <div className="w-0.5 h-0.5 bg-slate-700 rounded-full hidden sm:block"></div>
                <div className="flex items-center gap-1">
                  <Icon name="messageCircle" size={12} className="text-sky-400" />
                  <span>Real-time Seller Connect</span>
                </div>
              </div>
            </div>
          </section>





          {/* Trending Listings */}
          <section id="trending-section">
            <div className="glass-card rounded-[2rem] p-6 md:p-8 shadow-sm">
              {error ? (
                <IssueBanner message={error} onRetry={fetchListings} />
              ) : isLoading && !isAppending ? (
                <div className="grid grid-cols-2 min-[420px]:grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-2 sm:gap-3">
                  {[...Array(12)].map((_, i) => (
                    <SkeletonCard key={i} />
                  ))}
                </div>
              ) : listings.length === 0 ? (
                <div className="py-20 text-center">
                  <div className="w-16 h-16 bg-slate-50 text-slate-300 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Icon name="search" size={32} />
                  </div>
                  <h3 className="text-lg font-bold text-slate-800">No listings found</h3>
                  <p className="text-slate-500">Try adjusting your filters or location.</p>
                </div>
              ) : (
                <>
                  {/* Grid */}
                  <div className="grid grid-flow-row-dense grid-cols-2 min-[420px]:grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-2 sm:gap-3">
                    {(() => {
                      let adIndex = -1;
                      return mixedContent.map((item, idx) => {
                        if (item.type === 'listing') {
                          return (
                            <ListingCard key={item.data.id} listing={item.data} />
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

                  {isLoading && isAppending && (
                      <div className="mt-8 flex justify-center">
                          <Icon name="loader" size={24} className="animate-spin text-brand-500" />
                      </div>
                  )}

                  {/* Intersection Observer Target */}
                  <div ref={loaderRef} className="h-4 w-full" />

                  {/* Pagination */}
                  {totalPages > 1 && renderPagination()}
                </>
              )}
            </div>
          </section>
      </div>
    </div>
  );
};

export default Home;
