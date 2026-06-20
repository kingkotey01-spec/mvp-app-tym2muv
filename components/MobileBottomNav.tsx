import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import Icon from './Icon';
import { useAuth } from '../context/AuthContext';

const MobileBottomNav = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { isAuthenticated, isAuthReady, user } = useAuth();

  // Determine the correct profile path once auth is fully resolved
  const profilePath = isAuthReady
    ? (isAuthenticated && user?.id ? `/profile/${user.id}` : '/signin')
    : '/'; // while loading, keep them on home so tapping doesn't redirect prematurely

  const handlePostClick = (e: React.MouseEvent) => {
    e.preventDefault();
    if (!isAuthenticated || !user) {
      navigate('/signin', { 
        state: { from: { pathname: '/post' } } 
      });
    } else if (user.role === 'Admin' || user.role === 'Agent') {
      navigate('/post');
    } else {
      navigate('/create-vendor');
    }
  };
  
  const navItems = [
    { name: 'Home', path: '/', icon: 'home' },
    { name: 'Search', path: '/search', icon: 'search' },
    { name: 'Post', path: '/post', icon: 'plus', isFab: true, onClick: handlePostClick },
    { name: 'Financing', path: '/rent-financing', icon: 'coins' },
    { name: 'Profile', path: profilePath, icon: 'user',
      state: !isAuthenticated ? { from: { pathname: `/profile` } } : undefined },
  ];

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-[100] bg-white border-t border-slate-100 pb-safe pb-4 shadow-[0_-4px_12px_rgba(0,0,0,0.03)] selection:bg-transparent">
      <div className="flex items-center justify-around h-14 relative px-1">
        {navItems.map((item) => {
          const isFab = item.isFab;
          const isActive = isFab 
            ? (location.pathname === '/post' || location.pathname === '/create-vendor')
            : (location.pathname === item.path || (item.path !== '/' && location.pathname.startsWith(item.path)));
          
          if (isFab) {
            return (
              <button
                key={item.name}
                onClick={item.onClick}
                className="flex flex-col items-center justify-center flex-1 relative -top-3.5 z-50 cursor-pointer"
              >
                <div className={`w-11 h-11 rounded-xl bg-gradient-to-tr from-red-650 to-rose-500 text-white flex items-center justify-center shadow-lg shadow-red-500/25 border-2 border-white transform transition-transform duration-200 active:scale-90 ${isActive ? 'rotate-90 scale-105' : ''}`}>
                  <Icon name="plus" size={20} strokeWidth={3} />
                </div>
                <span className="text-[9px] font-extrabold text-slate-500 mt-1 uppercase tracking-wider text-center">
                  {item.name}
                </span>
              </button>
            );
          }

          return (
            <Link 
              key={item.name} 
              to={item.path}
              state={item.state}
              className={`flex flex-col items-center justify-center p-2 flex-1 transition-all ${isActive ? 'text-brand-600' : 'text-slate-400'}`}
            >
              <div className={`transition-transform duration-200 ${isActive ? 'scale-115 mb-0.5' : 'mb-0.5'}`}>
                <Icon name={item.icon as any} size={22} />
              </div>
              <span className={`text-[9px] font-bold uppercase tracking-wider ${isActive ? 'text-brand-600' : 'text-slate-500'}`}>
                {item.name}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
};

export default MobileBottomNav;
