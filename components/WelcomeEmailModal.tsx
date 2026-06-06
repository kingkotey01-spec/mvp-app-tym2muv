import React from 'react';
import { motion } from 'framer-motion';
import Icon from './Icon';
import { useAuth } from '../context/AuthContext';

interface WelcomeEmailModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const WelcomeEmailModal: React.FC<WelcomeEmailModalProps> = ({ isOpen, onClose }) => {
  const { user } = useAuth();

  if (!isOpen || !user) return null;

  const userEmail = user.email || 'your-email@example.com';
  const userName = user.name || 'friend';
  const loginLink = `${window.location.origin}/signin`;
  const formattedDate = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  return (
    <div className="fixed inset-0 z-[250] flex items-center justify-center p-4">
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 bg-slate-900/60 backdrop-blur-md"
      />

      {/* Email Container Card */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        transition={{ type: 'spring', damping: 25, stiffness: 350 }}
        className="relative bg-white rounded-3xl shadow-[0_25px_60px_-15px_rgba(109,40,217,0.3)] border border-slate-100 w-full max-w-2xl overflow-hidden z-10"
      >
        {/* Header - Styled Email Client Bar */}
        <div className="bg-slate-900 px-6 py-4 flex items-center justify-between text-white border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <span className="w-3 h-3 rounded-full bg-red-500 block"></span>
            <span className="w-3 h-3 rounded-full bg-yellow-500 block"></span>
            <span className="w-3 h-3 rounded-full bg-green-500 block"></span>
            <span className="text-xs text-slate-400 font-mono ml-2">tym2muv Mailer Delivery</span>
          </div>
          <button 
            onClick={onClose}
            className="text-slate-400 hover:text-white bg-white/10 hover:bg-white/20 p-1.5 rounded-xl transition-all cursor-pointer"
            aria-label="Close"
          >
            <Icon name="x" size={16} />
          </button>
        </div>

        {/* Email Header Info */}
        <div className="p-6 border-b border-slate-100 bg-slate-50/50">
          <div className="flex flex-col gap-2.5">
            <div className="flex text-sm">
              <span className="font-bold text-slate-500 w-16">From:</span>
              <span className="font-medium text-slate-800 flex items-center gap-1.5">
                tym2muv Team <span className="text-xs text-brand-600 font-mono bg-brand-50 px-2 py-0.5 rounded-md">welcome@tym2muv.com</span>
              </span>
            </div>
            <div className="flex text-sm col-span-2">
              <span className="font-bold text-slate-500 w-16">To:</span>
              <span className="font-semibold text-slate-800">
                {userName} <span className="text-xs font-normal text-slate-500">(&lt;{userEmail}&gt;)</span>
              </span>
            </div>
            <div className="flex text-sm">
              <span className="font-bold text-slate-500 w-16">Date:</span>
              <span className="font-medium text-slate-600">{formattedDate}</span>
            </div>
            <div className="flex text-sm pt-1 border-t border-slate-100/60">
              <span className="font-bold text-slate-500 w-16">Subject:</span>
              <span className="font-extrabold text-slate-900 tracking-tight text-base">
                you’re in. welcome to tym2muv 🔑
              </span>
            </div>
          </div>
        </div>

        {/* Beautiful Email Body */}
        <div className="p-8 max-h-[420px] overflow-y-auto custom-scrollbar bg-slate-50/30">
          <div className="max-w-md mx-auto bg-white rounded-2xl border border-slate-100 p-8 shadow-sm">
            
            {/* Branding Accent */}
            <div className="flex items-center gap-2.5 pb-6 mb-6 border-b border-slate-100">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-brand-600 to-fuchsia-600 flex items-center justify-center text-white font-extrabold text-lg shadow-md shadow-brand-500/20">
                tym
              </div>
              <div>
                <span className="font-bold text-slate-900 block text-sm">tym2muv</span>
                <span className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">Zero Headaches Real Estate</span>
              </div>
            </div>

            {/* Email Message Content */}
            <div className="space-y-5 text-slate-700 leading-relaxed font-sans">
              <p className="text-slate-800 font-semibold text-base">
                hey <span className="text-brand-600 font-bold capitalize">{userName}</span>, welcome to tym2muv!
              </p>

              <p className="text-sm">
                your account is active and the old-school real estate headaches are officially over.
              </p>

              {/* USP Boxes */}
              <div className="py-2 space-y-3">
                <div className="flex items-start gap-3 bg-emerald-50/60 p-3 rounded-xl border border-emerald-100/50">
                  <div className="mt-0.5 bg-emerald-500 text-white rounded-full p-1 flex items-center justify-center shrink-0">
                    <Icon name="check" size={10} strokeWidth={3} />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-emerald-900 block">100% verified listings</span>
                    <span className="text-[11px] text-emerald-700 font-medium">No fake ads, no scams. Every property verified by agents.</span>
                  </div>
                </div>

                <div className="flex items-start gap-3 bg-brand-50/60 p-3 rounded-xl border border-brand-100/50">
                  <div className="mt-0.5 bg-brand-500 text-white rounded-full p-1 flex items-center justify-center shrink-0">
                    <Icon name="check" size={10} strokeWidth={3} />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-brand-900 block">The Advance Skip</span>
                    <span className="text-[11px] text-brand-700 font-medium">We pay landlords upfront, you pay back in easy monthly splits.</span>
                  </div>
                </div>
              </div>

              <p className="text-sm">
                your next chapter starts right now. let's find your space.
              </p>

              {/* Core Login CTA button */}
              <div className="pt-4 flex justify-center">
                <a 
                  href={loginLink}
                  onClick={(e) => {
                    e.preventDefault();
                    onClose();
                  }}
                  className="inline-flex items-center gap-2 bg-gradient-to-r from-brand-600 to-fuchsia-600 hover:from-brand-700 hover:to-fuchsia-700 text-white font-extrabold text-sm px-6 py-3 rounded-xl shadow-lg shadow-brand-500/20 hover:shadow-brand-500/30 transition-all hover:scale-105"
                >
                  <span>find my spot ➡️</span>
                </a>
              </div>
            </div>

            {/* Footer Signoff */}
            <div className="mt-8 pt-6 border-t border-slate-100 text-center">
              <span className="text-[11px] text-slate-400 block font-medium">
                You received this email because you signed up on tym2muv.
              </span>
              <span className="text-[10px] text-slate-400 block mt-1 font-mono font-bold">
                SECURE AUTH LOGIN REF: {user.id.slice(0, 8).toUpperCase()}
              </span>
            </div>

          </div>
        </div>

        {/* In-app Toast info footer */}
        <div className="bg-slate-50 px-6 py-4 flex items-center justify-between border-t border-slate-100">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
            <span className="flex h-2 w-2 rounded-full bg-emerald-500 shrink-0"></span>
            <span>Delivered & synced with in-app notifications</span>
          </div>
          <button
            onClick={onClose}
            className="text-xs font-bold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 px-3 py-1.5 rounded-lg cursor-pointer transition-all"
          >
            Got it
          </button>
        </div>

      </motion.div>
    </div>
  );
};

export default WelcomeEmailModal;
