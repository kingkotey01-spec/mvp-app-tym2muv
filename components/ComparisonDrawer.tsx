import React, { useState } from 'react';
import { useComparison } from '../context/ComparisonContext';
import Icon from './Icon';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { getSymbolFromCode } from '../services/location';
import { generateListingTitle } from '../utils/listingUtils';

export const ComparisonDrawer: React.FC = () => {
  const { 
    comparedListings, 
    removeFromCompare, 
    clearCompare, 
    compareError,
    setCompareError 
  } = useComparison();

  const [isModalOpen, setIsModalOpen] = useState(false);

  if (comparedListings.length === 0) {
    return null;
  }

  // Define lines/features to compare in a structured format
  const features = [
    { key: 'price', name: 'price / rent', render: (l: any) => `${getSymbolFromCode(l.currency || 'USD')} ${l.price.toLocaleString()}` },
    { key: 'type', name: 'listing type', render: (l: any) => <span className="uppercase text-[11px] font-mono tracking-wider font-extrabold text-slate-300">{l.type}</span> },
    { key: 'propertyType', name: 'property type', render: (l: any) => l.propertyType },
    { key: 'location', name: 'location', render: (l: any) => <span className="line-clamp-2 text-xs text-slate-400">{l.location}</span> },
    { key: 'bedrooms', name: 'bedrooms', render: (l: any) => l.bedrooms ? `${l.bedrooms} beds` : '--' },
    { key: 'bathrooms', name: 'bathrooms', render: (l: any) => l.bathrooms ? `${l.bathrooms} baths` : '--' },
    { key: 'sqft', name: 'area (sqft)', render: (l: any) => l.sqft ? `${l.sqft.toLocaleString()} sqft` : '--' },
    { key: 'furnished', name: 'furnished', render: (l: any) => l.furnished ? <Icon name="check" size={16} className="text-[#00ffcc] mx-auto" /> : <Icon name="x" size={14} className="text-slate-600 mx-auto" /> },
    { key: 'parking', name: 'parking details', render: (l: any) => l.parking ? <Icon name="check" size={16} className="text-[#00ffcc] mx-auto" /> : <Icon name="x" size={14} className="text-slate-600 mx-auto" /> },
    { key: 'security', name: 'security desk', render: (l: any) => l.security ? <Icon name="check" size={16} className="text-[#00ffcc] mx-auto" /> : <Icon name="x" size={14} className="text-slate-600 mx-auto" /> },
    { key: 'petsAllowed', name: 'pets policy', render: (l: any) => l.petsAllowed ? 'pets allowed' : 'no pets' },
    { key: 'yearBuilt', name: 'year built', render: (l: any) => l.yearBuilt || '--' },
    { key: 'isVerified', name: 'verified safety', render: (l: any) => l.isVerified ? <span className="inline-flex items-center gap-1 text-[10px] bg-slate-900 border border-emerald-500/30 text-[#00ffcc] px-2 py-0.5 rounded-full font-mono">verified</span> : <span className="text-slate-500 font-mono text-xs">-</span> },
    { key: 'isPremium', name: 'premium listing', render: (l: any) => l.isPremium ? <span className="inline-flex items-center gap-1 text-[10px] bg-slate-900 border border-pink-500/30 text-[#ff007f] px-2 py-0.5 rounded-full font-mono">premium</span> : <span className="text-slate-500 font-mono text-xs">-</span> },
  ];

  return (
    <>
      {/* Floating comparison dock */}
      <div className="fixed bottom-20 md:bottom-6 left-1/2 -translate-x-1/2 z-[150] w-full max-w-xl px-4 pointer-events-none">
        
        {/* Error notification banner */}
        <AnimatePresence>
          {compareError && (
            <motion.div
              initial={{ opacity: 0, y: 15, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.95 }}
              className="bg-slate-950/95 border border-[#ff007f]/40 text-[#ff007f] text-xs font-semibold px-4 py-3 rounded-2xl mb-3 shadow-xl pointer-events-auto flex items-center gap-2.5 max-w-md mx-auto"
            >
              <Icon name="alert" size={14} className="animate-bounce shrink-0" />
              <span className="font-mono lowercase">{compareError}</span>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="pointer-events-auto bg-slate-950/95 border border-slate-800 rounded-[2rem] p-3.5 shadow-2xl shadow-black/80 flex items-center justify-between gap-4 w-full">
          {/* Selected listings slider/thumbs */}
          <div className="flex items-center gap-2.5 overflow-x-auto py-1 max-w-[55%] custom-scrollbar">
            {comparedListings.map((listing) => (
              <div key={listing.id} className="relative group/thumb shrink-0">
                <div className="w-11 h-11 rounded-xl overflow-hidden border border-slate-800 bg-slate-900 shadow-inner">
                  <img 
                    src={listing.imageUrl || 'https://via.placeholder.com/150'} 
                    alt="" 
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                </div>
                {/* Remove float button */}
                <button
                  onClick={() => removeFromCompare(listing.id)}
                  className="absolute -top-1.5 -right-1.5 bg-[#ff007f] hover:bg-pink-600 text-white rounded-full p-0.5 shadow-md border border-slate-950 hover:scale-105 duration-200"
                  title="Remove"
                >
                  <Icon name="x" size={10} />
                </button>
              </div>
            ))}
            
            {/* Empty Slots */}
            {Array.from({ length: 4 - comparedListings.length }).map((_, i) => (
              <div key={i} className="w-11 h-11 rounded-xl border border-dashed border-slate-800 bg-slate-900/20 flex items-center justify-center shrink-0">
                <Icon name="plus" size={12} className="text-slate-800" />
              </div>
            ))}
          </div>

          {/* Stats & Actions */}
          <div className="flex items-center gap-2 text-right shrink-0">
            <div className="hidden sm:block text-slate-400 font-mono text-[10px] lowercase mr-1">
              {comparedListings.length} / 4 properties
            </div>
            
            <button
              onClick={() => setIsModalOpen(true)}
              className="bg-gradient-to-r from-emerald-400 to-[#00ffcc] text-slate-950 hover:from-emerald-500 hover:to-[#00ffcc] font-black text-xs px-4 py-2.5 rounded-xl shadow-lg shadow-emerald-500/10 active:scale-[0.97] transition-all flex items-center gap-1.5 lowercase"
            >
              <Icon name="copy" size={12} className="text-slate-950 animate-pulse" />
              <span>compare now</span>
            </button>
            
            <button
              onClick={clearCompare}
              className="text-slate-500 hover:text-[#ff007f] p-1.5 duration-200 rounded-lg hover:bg-slate-900"
              title="Clear all"
            >
              <Icon name="trash" size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* Comparisons Fullscreen Side-by-Side Modal Overlay */}
      <AnimatePresence>
        {isModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.95, y: 30 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 20 }}
              transition={{ type: 'spring', damping: 25, stiffness: 220 }}
              className="bg-slate-950 border border-slate-900 rounded-[2.5rem] w-full max-w-5xl h-[85vh] flex flex-col shadow-2xl relative overflow-hidden"
            >
              {/* Electric Neon Accent Blur Glows */}
              <div className="absolute top-0 right-10 w-[250px] h-[250px] bg-[#00ffcc]/5 rounded-full blur-[100px] pointer-events-none"></div>
              <div className="absolute bottom-0 left-10 w-[200px] h-[200px] bg-[#ff007f]/5 rounded-full blur-[90px] pointer-events-none"></div>

              {/* Modal Header */}
              <div className="relative z-10 flex items-center justify-between p-6 sm:px-8 border-b border-slate-900 flex-shrink-0">
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#00ffcc] animate-ping"></span>
                    <span className="text-[10px] font-bold uppercase tracking-wider font-mono text-[#00ffcc]">side-by-side properties comparison bench</span>
                  </div>
                  <h2 className="text-xl sm:text-2xl font-black font-sans leading-none text-white lowercase">
                    compare selected aesthetics.
                  </h2>
                </div>
                
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="bg-slate-900 border border-slate-800 text-slate-400 hover:text-white p-2.5 rounded-2xl cursor-pointer duration-200 hover:scale-105 active:scale-95"
                  title="Close modal"
                >
                  <Icon name="x" size={16} />
                </button>
              </div>

              {/* Modal Table Content */}
              <div className="relative z-10 flex-grow overflow-auto p-4 sm:p-8 custom-scrollbar">
                
                {/* Horizontal flow wrapper */}
                <div className="min-w-[640px] h-full flex flex-col">
                  
                  {/* Table Header Blocks (Listings info) */}
                  <div className="grid grid-cols-5 gap-4 border-b border-slate-900 pb-6 mb-6">
                    {/* Empty Left labels slot */}
                    <div className="flex flex-col justify-end">
                      <div className="text-xs font-mono font-bold text-slate-500 lowercase">
                        features overview & details
                      </div>
                    </div>

                    {comparedListings.map((listing) => {
                      const title = generateListingTitle({
                        bedrooms: listing.bedrooms,
                        propertyType: listing.propertyType,
                      });
                      return (
                        <div key={listing.id} className="group relative rounded-2xl bg-slate-900/30 border border-slate-900 p-3 hover:border-slate-800 transition-all flex flex-col justify-between">
                          <button
                            onClick={() => {
                              removeFromCompare(listing.id);
                              if (comparedListings.length <= 1) {
                                setIsModalOpen(false);
                              }
                            }}
                            className="absolute top-2 right-2 bg-slate-950 text-slate-500 hover:text-[#ff007f] rounded-full p-1 border border-slate-900 hover:scale-105 transition-all z-20"
                            title="Remove from comparison list"
                          >
                            <Icon name="trash" size={11} />
                          </button>

                          <div className="space-y-2.5">
                            <div className="aspect-[3/2] rounded-xl bg-slate-950 overflow-hidden relative shadow-inner">
                              <img 
                                src={listing.imageUrl || 'https://images.unsplash.com/photo-1518780664697-55e3ad937233?w=800&fit=crop'} 
                                alt="" 
                                className="w-full h-full object-cover transition-transform group-hover:scale-105 duration-300"
                                referrerPolicy="no-referrer"
                              />
                            </div>
                            
                            <div className="space-y-1">
                              <h3 className="text-white text-xs font-bold font-sans line-clamp-1 leading-snug">
                                {title}
                              </h3>
                              <div className="flex justify-between items-baseline">
                                <span className="text-[10px] font-mono font-semibold tracking-wider text-slate-400 lowercase">{listing.propertyType}</span>
                                <span className="text-xs font-bold text-emerald-400 font-mono">
                                  {getSymbolFromCode(listing.currency || 'USD')} {listing.price.toLocaleString()}
                                </span>
                              </div>
                            </div>
                          </div>

                          <div className="mt-3 pt-3 border-t border-slate-900 flex gap-2">
                            <Link
                              to={`/listing/${listing.id}`}
                              className="flex-grow inline-flex items-center justify-center bg-slate-900 hover:bg-slate-800 text-white font-bold text-[10px] py-1.5 px-3 rounded-xl border border-slate-800 text-center transition-colors lowercase"
                              onClick={() => setIsModalOpen(false)}
                            >
                              view detail
                            </Link>
                            <Link
                              to={`/chat?to=${listing.sellerId}`}
                              className="bg-emerald-500/10 hover:bg-emerald-500/20 text-[#00ffcc] border border-emerald-500/20 rounded-xl p-1.5 flex items-center justify-center transition-colors"
                              title="Chat with host"
                              onClick={() => setIsModalOpen(false)}
                            >
                              <Icon name="messageCircle" size={12} />
                            </Link>
                          </div>
                        </div>
                      );
                    })}

                    {/* Placeholder spots */}
                    {Array.from({ length: 4 - comparedListings.length }).map((_, idx) => (
                      <div key={idx} className="border border-dashed border-slate-900 rounded-2xl bg-slate-950/20 flex flex-col items-center justify-center p-4 text-center">
                        <div className="w-9 h-9 rounded-full bg-slate-900/40 border border-slate-800 flex items-center justify-center mb-2">
                          <Icon name="plus" size={14} className="text-slate-700" />
                        </div>
                        <p className="text-[10px] text-slate-600 font-mono lowercase">slot empty</p>
                      </div>
                    ))}
                  </div>

                  {/* Feature Rows */}
                  <div className="space-y-1 flex-grow">
                    {features.map((feature, rIdx) => (
                      <div 
                        key={feature.key} 
                        className={`grid grid-cols-5 p-3.5 rounded-xl font-sans text-xs items-center transition-colors ${
                          rIdx % 2 === 0 ? 'bg-slate-900/10' : 'bg-transparent'
                        }`}
                      >
                        {/* Left labels */}
                        <div className="font-semibold text-slate-400 uppercase tracking-wide text-[10px] font-mono">
                          {feature.name}
                        </div>

                        {/* Property Values */}
                        {comparedListings.map((listing) => (
                          <div key={listing.id} className="text-white font-medium pl-1 text-xs">
                            {feature.render(listing)}
                          </div>
                        ))}

                        {/* Placeholder Spot Values */}
                        {Array.from({ length: 4 - comparedListings.length }).map((_, idx) => (
                          <div key={idx} className="text-slate-750 font-mono text-center text-xs">
                            --
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>

                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};
