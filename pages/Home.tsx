
import React, { useMemo, useState, useEffect, useRef } from 'react';
import { CATEGORIES } from '../constants';
import ListingCard from '../components/ListingCard';
import AdCard from '../components/AdCard';
import { getListings, getMonetizationAds } from '../services/supabaseService';
import Icon from '../components/Icon';
import { Link } from 'react-router-dom';
import { useLocation as useAppLocation } from '../context/LocationContext';
import { useMixedContent } from '../hooks/useMixedContent';
import ErrorBanner from '../components/ErrorBanner';
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
              return [...prev, ...uniqueNew];
          });
      } else {
          setListings(fetchedListings);
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
                  <span>5,000+ Daily Verified Listings</span>
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

          {/* Category Quick Filter Bento section */}
          <section className="mt-1">
            <div className="glass-card rounded-3xl p-4 md:p-5 shadow-sm border border-slate-100/50 bg-white/45 backdrop-blur-md">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-1 mb-4">
                <div>
                  <h2 className="text-base font-display font-bold text-slate-900 tracking-tight flex items-center gap-2">
                    <Icon name="sliders" size={16} className="text-brand-600 animate-pulse" />
                    How can we help you today?
                  </h2>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {[
                  {
                    id: 'houses',
                    name: 'Houses & Apartments',
                    description: 'Explore verified apartments, homes, condos, and premium villas.',
                    textColor: 'text-blue-600',
                    lightBg: 'bg-blue-50/70',
                    icon: 'home',
                  },
                  {
                    id: 'land',
                    name: 'Lands & Plots',
                    description: 'Find verified residential, agricultural, and commercial plots.',
                    textColor: 'text-emerald-600',
                    lightBg: 'bg-emerald-50/70',
                    icon: 'mapPin',
                  },
                  {
                    id: 'offices',
                    name: 'Offices & Shops',
                    description: 'Browse prime corporate offices, co-working, and commercial settings.',
                    textColor: 'text-amber-600',
                    lightBg: 'bg-amber-50/70',
                    icon: 'briefcase',
                  },
                  {
                    id: 'warehouses',
                    name: 'Warehouses & Storage',
                    description: 'Find storage facilities, cold storage, cargo docks, and fulfillment sites.',
                    textColor: 'text-indigo-600',
                    lightBg: 'bg-indigo-50/70',
                    icon: 'package',
                  }
                ].map(cat => (
                  <Link
                    key={cat.id}
                    to={`/search?categoryId=${cat.id}`}
                    className="group relative overflow-hidden rounded-2xl p-4 border border-slate-200/60 bg-white/80 hover:border-transparent transition-all shadow-sm hover:shadow-md hover:-translate-y-0.5 flex flex-col justify-between min-h-[125px] duration-300"
                  >
                    {/* Hover subtle overlay */}
                    <div className="absolute inset-0 bg-gradient-to-br opacity-0 group-hover:opacity-[0.03] transition-opacity duration-500 from-purple-500 to-indigo-600" />
                    
                    <div className="flex justify-between items-start z-10">
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${cat.lightBg} ${cat.textColor} group-hover:scale-105 transition-transform duration-300 shadow-sm`}>
                        <Icon name={cat.icon} size={16} />
                      </div>
                      <span className="text-slate-300 group-hover:text-brand-600 group-hover:translate-x-0.5 transition-all duration-300">
                        <Icon name="chevronRight" size={14} />
                      </span>
                    </div>

                    <div className="mt-3 relative z-10">
                      <h3 className="font-bold text-slate-800 text-xs sm:text-sm group-hover:text-brand-700 transition-colors tracking-tight">{cat.name}</h3>
                      <p className="text-slate-400 text-[11px] mt-1 leading-normal group-hover:text-slate-600 transition-colors">{cat.description}</p>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          </section>

          {/* Muv Now, Pay Monthly Rent Financing Program */}
          <section className="mt-1 animate-slide-up">
            <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#8607C1] to-[#240035] text-white p-5 md:p-7 border border-[#CF8EED]/20 shadow-lg shadow-[#8607C1]/10">
              {/* Decorative Glows */}
              <div className="absolute top-0 right-0 w-[200px] h-[200px] bg-emerald-500/5 rounded-full blur-[80px] pointer-events-none"></div>
              <div className="absolute bottom-0 left-0 w-[150px] h-[150px] bg-[#fb00ff]/5 rounded-full blur-[80px] pointer-events-none"></div>

              <div className="relative z-10 flex flex-col gap-5">
                {/* Header */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3 border-b border-[#CF8EED]/10 pb-4">
                  <div className="space-y-1">
                    <div className="inline-flex items-center gap-1 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 px-2.5 py-1 rounded-full text-[10px] font-semibold tracking-wider font-mono lowercase">
                      <span className="w-1 h-1 rounded-full bg-[#39FF14] animate-ping"></span>
                      tym2muv rent financing program
                    </div>
                    <h2 className="text-lg md:text-xl font-black font-sans tracking-tight text-white leading-tight lowercase">
                      muv now, pay monthly.
                    </h2>
                    <p className="text-slate-350 text-[11px] md:text-xs max-w-xl lowercase leading-relaxed">
                      struggling with huge upfront landlord advances? select any verified listings, we'll cover the landlord upfront while you pay us in stress-free monthly tiers.
                    </p>
                  </div>
                  <div className="flex-shrink-0 w-full md:w-auto">
                    <Link
                      id="apply-financing-home-banner-btn"
                      to="/rent-financing"
                      className="inline-flex items-center justify-center gap-1.5 bg-gradient-to-r from-emerald-400 via-[#00ffcc] to-sky-450 hover:opacity-90 font-extrabold text-xs text-slate-950 px-4.5 py-2.5 rounded-lg shadow-md shadow-emerald-500/10 duration-200 transition-all hover:scale-[1.01] active:scale-99 w-full md:w-auto lowercase"
                    >
                      <span>calculate & apply now</span>
                      <Icon name="chevronRight" size={13} />
                    </Link>
                  </div>
                </div>

                {/* 3 Step breakdown */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
                  {/* Step 1 */}
                  <div className="group relative overflow-hidden rounded-xl bg-black/25 border border-white/10 p-4 flex flex-col gap-2.5 hover:border-emerald-500/20 transition-all duration-300">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-slate-950 text-[#00ffcc] font-mono font-bold text-xs border border-white/10 group-hover:bg-emerald-500 group-hover:text-slate-950 transition-all">
                      01
                    </div>
                    <div className="space-y-0.5">
                      <h3 className="font-bold text-white text-xs md:text-sm tracking-tight"><span className="text-[#00ffcc]">find the vibe:</span> browse 100% verified listings.</h3>
                      <p className="text-slate-350 text-[11px] leading-relaxed lowercase">
                        every listing on tym2muv goes through robust background validation to ensure what you see is what you lock down.
                      </p>
                    </div>
                  </div>

                  {/* Step 2 */}
                  <div className="group relative overflow-hidden rounded-xl bg-black/25 border border-white/10 p-4 flex flex-col gap-2.5 hover:border-[#ff007f]/20 transition-all duration-300">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-slate-950 text-[#ff007f] font-mono font-bold text-xs border border-white/10 group-hover:bg-pink-500 group-hover:text-slate-950 transition-all">
                      02
                    </div>
                    <div className="space-y-0.5">
                      <h3 className="font-bold text-white text-xs md:text-sm tracking-tight"><span className="text-[#ff007f]">we pay upfront:</span> tym2muv covers the landlord's required advance.</h3>
                      <p className="text-slate-350 text-[11px] leading-relaxed lowercase">
                        no more saving up for 12 or 24 months of advance rent files. we handle the full upfront check for you instantly.
                      </p>
                    </div>
                  </div>

                  {/* Step 3 */}
                  <div className="group relative overflow-hidden rounded-xl bg-black/25 border border-white/10 p-4 flex flex-col gap-2.5 hover:border-sky-500/20 transition-all duration-300">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-slate-950 text-sky-400 font-mono font-bold text-xs border border-white/10 group-hover:bg-sky-400 group-hover:text-slate-950 transition-all">
                      03
                    </div>
                    <div className="space-y-0.5">
                      <h3 className="font-bold text-white text-xs md:text-sm tracking-tight"><span className="text-sky-400">move in & pay monthly:</span> you move in immediately and pay a predictable, stress-free monthly rate.</h3>
                      <p className="text-slate-350 text-[11px] leading-relaxed lowercase">
                        take full control of your liquidity. split your rent over predictable, easy-to-manage monthly installments.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Trending Listings */}
          <section id="trending-section">
            <div className="glass-card rounded-[2rem] p-6 md:p-8 shadow-sm">
              {error ? (
                <ErrorBanner message={error} onRetry={fetchListings} />
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
                  <div className="grid grid-cols-2 min-[420px]:grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-2 sm:gap-3">
                    {mixedContent.map((item, idx) => (
                      item.type === 'listing' ? (
                        <ListingCard key={item.data.id} listing={item.data} />
                      ) : (
                        <AdCard 
                          key={`ad-${idx}`} 
                          id={item.data.id}
                          type={item.data.type}
                          title={item.data.title}
                          description={item.data.description}
                          cta={item.data.cta}
                          image={item.data.image}
                          color={item.data.color}
                          link={item.data.link}
                          className={`${
                            idx % 2 === 0 ? 'col-start-1' : 'col-start-2'
                          } min-[420px]:col-start-${(idx % 3) + 1} sm:col-start-${(idx % 4) + 1} md:col-start-${(idx % 5) + 1} lg:col-start-${(idx % 6) + 1}`}
                        />
                      )
                    ))}
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
