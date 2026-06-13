import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { getListings, getSavedListingIds, toggleSavedListing } from '../services/supabaseService';
import { Listing } from '../types';
import ListingCard from '../components/ListingCard';
import Icon from '../components/Icon';
import { useToast } from '../components/Toast';
import SkeletonCard from '../components/SkeletonCard';

const SavedListings: React.FC = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);

  const handleUnsave = async (listingId: string) => {
    if (!user) return;
    try {
      await toggleSavedListing(user.id, listingId);
      setListings(prev => prev.filter(l => l.id !== listingId));
      toast('Removed from saved properties.', 'info');
    } catch (err) {
      console.error('Failed to unsave listing:', err);
      toast('Failed to remove. Please try again.', 'error');
    }
  };

  useEffect(() => {
    if (!user) { 
        setLoading(false); 
        return; 
    }
    const fetchSaved = async () => {
        try {
          const ids = await getSavedListingIds(user.id);
          if (!ids.length) { 
              setListings([]);
              setLoading(false); 
              return; 
          }
          const { listings: saved } = await getListings({ savedIds: ids, limit: 50 });
          setListings(saved);
        } catch (err) {
          console.error('Error fetching saved listings:', err);
        } finally {
          setLoading(false);
        }
    };
    fetchSaved();
  }, [user]);

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-slate-900 mb-6 font-display">Saved Properties</h1>
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {Array.from({ length: 4 }).map((_, idx) => (
            <SkeletonCard key={`skeleton-saved-${idx}`} />
          ))}
        </div>
      ) : listings.length === 0 ? (
        <div className="text-center py-20 text-slate-400">
          <Icon name="heart" size={48} className="mx-auto mb-4 opacity-30"/>
          <p className="text-lg">No saved properties yet.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {listings.map(l => (
            <div key={l.id} className="relative group h-full">
              <ListingCard listing={l} />
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  handleUnsave(l.id);
                }}
                className="absolute top-3 right-3 z-30 bg-white/95 backdrop-blur rounded-full p-1.5 shadow-md border border-slate-100 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-all hover:bg-red-50 text-slate-500 hover:text-red-500 cursor-pointer"
                title="Remove from saved"
              >
                <Icon name="x" size={14} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default SavedListings;
