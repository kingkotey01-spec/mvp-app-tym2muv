import React, { createContext, useContext, useState, useEffect } from 'react';
import { Listing } from '../types';

interface ComparisonContextType {
  comparedListings: Listing[];
  addToCompare: (listing: Listing) => boolean;
  removeFromCompare: (id: string) => void;
  clearCompare: () => void;
  isCompared: (id: string) => boolean;
  compareError: string | null;
  setCompareError: (err: string | null) => void;
}

const ComparisonContext = createContext<ComparisonContextType | undefined>(undefined);

export const ComparisonProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [comparedListings, setComparedListings] = useState<Listing[]>(() => {
    try {
      const saved = localStorage.getItem('tym2muv_compared_listings');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [compareError, setCompareError] = useState<string | null>(null);

  useEffect(() => {
    localStorage.setItem('tym2muv_compared_listings', JSON.stringify(comparedListings));
  }, [comparedListings]);

  const addToCompare = (listing: Listing): boolean => {
    if (comparedListings.some((item) => item.id === listing.id)) return true;
    
    if (comparedListings.length >= 4) {
      setCompareError("you can select a maximum of 4 listings to compare side-by-side.");
      setTimeout(() => setCompareError(null), 4000);
      return false;
    }
    
    setComparedListings((prev) => [...prev, listing]);
    setCompareError(null);
    return true;
  };

  const removeFromCompare = (id: string) => {
    setComparedListings((prev) => prev.filter((item) => item.id !== id));
  };

  const clearCompare = () => {
    setComparedListings([]);
    setCompareError(null);
  };

  const isCompared = (id: string) => {
    return comparedListings.some((item) => item.id === id);
  };

  return (
    <ComparisonContext.Provider 
      value={{ 
        comparedListings, 
        addToCompare, 
        removeFromCompare, 
        clearCompare, 
        isCompared,
        compareError,
        setCompareError
      }}
    >
      {children}
    </ComparisonContext.Provider>
  );
};

export const useComparison = () => {
  const context = useContext(ComparisonContext);
  if (!context) {
    return {
      comparedListings: [],
      addToCompare: () => false,
      removeFromCompare: () => {},
      clearCompare: () => {},
      isCompared: () => false,
      compareError: null,
      setCompareError: () => {}
    };
  }
  return context;
};
