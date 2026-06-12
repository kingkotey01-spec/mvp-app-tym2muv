import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Icon from '../components/Icon';

const NotFound: React.FC = () => {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  return (
    <div className="min-h-[85vh] flex flex-col items-center justify-center text-center px-4 py-12 relative overflow-hidden bg-brand-50/20">
      <div className="w-full max-w-lg glass-card rounded-3xl p-8 sm:p-10 border border-slate-150/80 shadow-xl flex flex-col items-center relative z-10 animate-fade-in bg-white/85 backdrop-blur-md">
        {/* Glow decoration */}
        <div className="absolute -top-10 -left-10 w-40 h-40 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-10 -right-10 w-40 h-40 bg-fuchsia-400/10 rounded-full blur-3xl pointer-events-none" />

        <div className="w-16 h-16 bg-red-50 text-red-500 border border-red-100 rounded-2xl flex items-center justify-center mb-6 shadow-sm scale-110">
          <Icon name="alert" size={32} strokeWidth={2.5} />
        </div>

        <h1 className="text-6xl font-black bg-gradient-to-r from-slate-900 via-brand-950 to-indigo-950 bg-clip-text text-transparent mb-2 tracking-tight">404</h1>
        <h2 className="text-xl font-bold text-slate-800 mb-2">Page Not Found</h2>
        <p className="text-sm text-slate-500 mb-8 max-w-sm font-medium leading-relaxed">
          We couldn't find the page you're looking for. It might have been moved, deleted, or doesn't exist anymore.
        </p>

        {/* Suggestion 1: Search bar */}
        <div className="w-full mb-6">
          <form onSubmit={handleSearchSubmit} className="relative flex items-center bg-slate-50 border border-slate-200 rounded-2xl p-1 shadow-inner focus-within:ring-2 focus-within:ring-brand-500/15 focus-within:border-brand-500 transition-all">
            <div className="pl-3.5 text-slate-400">
              <Icon name="search" size={18} />
            </div>
            <input 
              type="text" 
              placeholder="Try searching for a property..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-transparent border-0 outline-none text-sm font-semibold text-slate-705 pl-2.5 pr-20 py-2.5"
            />
            <button 
              type="submit"
              className="absolute right-1 px-4 py-2 bg-slate-900 text-white rounded-xl font-bold text-xs hover:bg-brand-600 transition-all active:scale-95 cursor-pointer"
            >
              Search
            </button>
          </form>
        </div>

        {/* Suggestion 2: Action links */}
        <div className="flex flex-col sm:flex-row items-center gap-3 w-full">
          <Link 
            to="/search" 
            className="w-full py-3 bg-brand-600 text-white font-bold text-sm rounded-xl hover:bg-brand-700 hover:shadow-lg hover:shadow-brand-500/15 transition-all text-center flex items-center justify-center gap-2 active:scale-[0.98]"
          >
            <Icon name="layout" size={16} />
            View All Listings
          </Link>
          <Link 
            to="/" 
            className="w-full py-3 bg-slate-100 text-slate-700 font-bold text-sm rounded-xl hover:bg-slate-200 transition-all text-center flex items-center justify-center gap-2 active:scale-[0.98]"
          >
            <Icon name="home" size={16} />
            Go back Home
          </Link>
        </div>
      </div>
    </div>
  );
};

export default NotFound;
