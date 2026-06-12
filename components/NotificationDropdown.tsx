import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Icon from './Icon';
import { useAuth } from '../context/AuthContext';
import { Link } from 'react-router-dom';
import { getNotificationsForUser, markNotificationRead, markAllNotificationsReadForUser, clearAllNotificationsForUser, Notification } from '../services/supabaseService';

const formatTimeAgo = (dateString: string) => {
  try {
    const rDate = new Date(dateString);
    const seconds = Math.floor((new Date().getTime() - rDate.getTime()) / 1000);
    if (seconds < 60) return 'Just now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  } catch (_) {
    return 'Recently';
  }
};

const NotificationDropdown = () => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { isAuthenticated, user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchNotifs = async () => {
    if (user?.id) {
      setLoading(true);
      const data = await getNotificationsForUser(user.id);
      setNotifications(data);
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifs();
  }, [user?.id]);

  useEffect(() => {
    const handleNotifUpdate = () => {
      fetchNotifs();
    };
    window.addEventListener('tym2muv_notifications_updated', handleNotifUpdate);
    window.addEventListener('welcome_email_received', handleNotifUpdate);
    return () => {
      window.removeEventListener('tym2muv_notifications_updated', handleNotifUpdate);
      window.removeEventListener('welcome_email_received', handleNotifUpdate);
    };
  }, [user?.id]);

  const unreadCount = notifications.filter((n: any) => !n.read).length;

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleMarkAllAsRead = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (user?.id) {
      await markAllNotificationsReadForUser(user.id);
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    }
  };

  const handleClearAll = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (user?.id) {
      await clearAllNotificationsForUser(user.id);
      setNotifications([]);
    }
  };

  const handleNotificationClick = async (notif: Notification) => {
    if (!notif.read) {
      await markNotificationRead(notif.id);
      setNotifications(prev => prev.map(n => n.id === notif.id ? { ...n, read: true } : n));
    }
    setIsOpen(false);
    if (notif.link === '#welcome-email') {
      window.dispatchEvent(new Event('open_welcome_email'));
    }
  };

  if (!isAuthenticated) return null;

  return (
    <div className="relative" ref={dropdownRef}>
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="p-1.5 sm:p-2 text-slate-500 hover:text-brand-600 hover:bg-brand-50 rounded-full transition-all relative group shadow-none outline-none focus:ring-2 focus:ring-brand-500/20"
        aria-label="Notifications"
        id="notification-dropdown-trigger"
      >
        <Icon name="bell" size={20} className="sm:w-[22px] sm:h-[22px]" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 flex h-3 w-3 items-center justify-center rounded-full bg-red-500 text-[8px] font-bold text-white border border-white">
            {unreadCount}
          </span>
        )}
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div 
            id="notification-dropdown-menu"
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 mt-2 w-80 bg-white rounded-2xl shadow-xl border border-slate-100 overflow-hidden z-[200]"
          >
            <div className="p-3 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <h3 className="font-extrabold text-xs text-slate-900">Notifications</h3>
              <div className="flex gap-1.5">
                <button 
                  onClick={handleMarkAllAsRead}
                  className="text-[9px] font-bold text-brand-700 bg-brand-50 px-2 py-0.5 rounded-full hover:bg-brand-100 transition-colors cursor-pointer"
                  id="mark-all-read-btn"
                >
                  Mark read
                </button>
                <button 
                  onClick={handleClearAll}
                  className="text-[9px] font-bold text-red-700 bg-red-50 px-2 py-0.5 rounded-full hover:bg-red-100 transition-colors cursor-pointer"
                  id="clear-all-read-btn"
                >
                  Clear all
                </button>
              </div>
            </div>
            
            <div className="max-h-[250px] overflow-y-auto custom-scrollbar">
              {loading && notifications.length === 0 ? (
                <div className="p-6 text-center text-slate-400 text-xs font-semibold">
                  Loading...
                </div>
              ) : notifications.length > 0 ? (
                <div className="flex flex-col">
                  {notifications.map((notif: Notification) => (
                    <Link 
                      key={notif.id}
                      to={notif.link === '#welcome-email' ? '#' : (notif.link || '#')}
                      onClick={(e) => {
                        if (notif.link === '#welcome-email' || !notif.link) {
                          e.preventDefault();
                        }
                        handleNotificationClick(notif);
                      }}
                      className={`p-3 border-b border-slate-50 hover:bg-slate-50 transition-colors ${!notif.read ? 'bg-brand-50/30 font-medium' : ''}`}
                      id={`notification-item-${notif.id}`}
                    >
                      <div className="flex gap-2">
                        <div className={`mt-1.5 w-1.5 h-1.5 rounded-full shrink-0 ${!notif.read ? 'bg-brand-500' : 'bg-transparent'}`} />
                        <div className="flex-1">
                          <h4 className={`text-xs font-bold leading-tight ${!notif.read ? 'text-slate-900' : 'text-slate-600'}`}>{notif.title}</h4>
                          <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">{notif.text}</p>
                          <span className="text-[9px] font-semibold text-slate-400 mt-1 block">{formatTimeAgo(notif.createdAt)}</span>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="p-6 text-center text-slate-400 text-xs font-medium">
                  No notifications yet
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default NotificationDropdown;
