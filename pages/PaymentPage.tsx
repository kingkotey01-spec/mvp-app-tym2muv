import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import { getListingById } from '../services/supabaseService';
import { supabase } from '../supabaseClient';
import { Listing } from '../types';
import Icon from '../components/Icon';
import { getSymbolFromCode } from '../services/location';
import { generateIdempotencyKey } from '../utils/idempotency';
import { logger } from '../utils/logger';

const loadPaystackScript = (): Promise<boolean> => {
  return new Promise((resolve) => {
    if ((window as any).PaystackPop) {
      resolve(true);
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://js.paystack.co/v1/inline.js';
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
};

const PaymentPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [listing, setListing] = useState<Listing | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [showBankDetails, setShowBankDetails] = useState(false);
  const [idempotencyKey, setIdempotencyKey] = useState<string>('');
  const [isLoadingListing, setIsLoadingListing] = useState(true);
  const [paymentIntent, setPaymentIntent] = useState<'promotion' | 'deposit' | null>(null);

  const getPremiumPrice = (currency: string): number => {
    const RATES: Record<string, number> = {
      USD: 1,
      GHS: 12.5,  // $8 * 12.5 = 100 GHS
      NGN: 1500,  // $8 * 1500 = 12000 NGN
      KES: 132,   // $8 * 132 = 1056 KES
      ZAR: 18.9,  // $8 * 18.9 = 151 ZAR
      EGP: 48.5,
      MAD: 10.1,
      ETB: 56.5,
      TZS: 2550,
      UGX: 3900,  // $8 * 3900 = 31200 UGX
      RWF: 1280,
      XOF: 605,
      XAF: 605,
      ZMW: 25.5,
      EUR: 0.92,
      GBP: 0.79,
    };
    const rate = RATES[currency?.toUpperCase()] || 1;
    return Math.round(8 * rate);
  };

  const getPriceToPay = () => {
    if (!listing) return 0;
    if (paymentIntent === 'promotion') {
      return getPremiumPrice(listing.currency || 'USD');
    }
    return listing.price;
  };

  const priceToPay = getPriceToPay();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const intentParam = params.get('intent');
    if (intentParam === 'promote' || intentParam === 'promotion') {
      setPaymentIntent('promotion');
    } else if (intentParam === 'deposit' || intentParam === 'rent_deposit') {
      setPaymentIntent('deposit');
    }
  }, []);

  useEffect(() => {
    if (!user) {
      navigate('/signin');
      return;
    }
    const fetchListing = async () => {
      setIsLoadingListing(true);
      if (id) {
        try {
          const data = await getListingById(id);
          setListing(data);
          
          if (data) {
            const params = new URLSearchParams(window.location.search);
            const intentParam = params.get('intent');
            
            if (data.sellerId === user.id) {
              // Listing Owner: Force 'promotion' and prevent deposit/booking
              setPaymentIntent('promotion');
            } else {
              // Regular Tenant: Force 'deposit' and prevent promotion
              setPaymentIntent('deposit');
            }
          }
        } catch (err) {
          console.error("Error setting up payment details:", err);
        }
      }
      setIsLoadingListing(false);
    };
    fetchListing();
  }, [id, user, navigate]);

  useEffect(() => {
    const updateIdempotency = async () => {
      if (listing && user) {
        try {
          const key = await generateIdempotencyKey(user.id, listing.id, priceToPay);
          setIdempotencyKey(key);
        } catch (err) {
          console.error("Error generating idempotency key:", err);
        }
      }
    };
    updateIdempotency();
  }, [listing, user, paymentIntent, priceToPay]);

  // Trigger script load early
  useEffect(() => {
    loadPaystackScript();
  }, []);

  const processPaymentWithRetry = async (reference: string, retries = 3, delay = 1000): Promise<void> => {
    try {
      const { data, error } = await supabase.functions.invoke('process-payment', {
        body: { reference, listingId: listing!.id, idempotencyKey, purpose: paymentIntent }
      });
      
      // 409 Conflict can be handled if idempotency checks out
      if (error || !data?.success) {
         throw new Error(data?.error || 'Payment verification failed');
      }
      setIsSuccess(true);
    } catch (err: any) {
      logger.error("Payment processing error", { error: err, reference, idempotencyKey });
      
      // Only retry on network errors or 5xx, wait, edge function invoke throws error if not 2xx.
      // We'll just retry for any failure until retries exhausted.
      if (retries > 0) {
         logger.warn(`Retrying payment verification... ${retries} attempts left`);
         await new Promise(resolve => setTimeout(resolve, delay));
         return processPaymentWithRetry(reference, retries - 1, delay * 2); // Exponential backoff
      }
      
      throw err;
    }
  };

  const handlePaystackPayment = async () => {
    if (!listing || !user || !idempotencyKey) return;
    
    let PAYSTACK_KEY = import.meta.env.VITE_PAYSTACK_PUBLIC_KEY;
    if (!PAYSTACK_KEY || PAYSTACK_KEY === 'your-paystack-public-key') {
      // In development or test sandbox, fallback to a standard public test key so checkout flows work out of the box
      PAYSTACK_KEY = 'pk_test_a0d8ecda640dfdf86e5c54df3f6fbf0b809beada';
      logger.info('Using standard Paystack public test key as sandbox fallback.');
    }
    
    if (import.meta.env.PROD && !PAYSTACK_KEY.startsWith('pk_live_')) {
      console.error('WARNING: Using Paystack test key in production!');
    }
    
    const loaded = await loadPaystackScript();
    if (!loaded || !(window as any).PaystackPop) {
       toast("Could not load Paystack. Please check your network connection.", "error");
       return;
    }
    
    const handler = (window as any).PaystackPop.setup({
      key: PAYSTACK_KEY,
      email: user.email || user.socials?.email || 'customer@example.com',
      amount: priceToPay * 100, // Amount in kobo/pesewas
      currency: listing.currency || 'GHS',
      ref: `TYM_${crypto.randomUUID().replace(/-/g, '').slice(0, 16).toUpperCase()}`,
      metadata: { listingId: listing.id, userId: user.id, purpose: paymentIntent, idempotencyKey },
      callback: async (response: any) => {
        setIsProcessing(true);
        try {
          await processPaymentWithRetry(response.reference);
        } catch (err) {
          console.error("Payment failed", err);
          toast('Payment could not be verified. Please contact support with reference: ' + response.reference, 'error');
        } finally {
          setIsProcessing(false);
        }
      },
      onClose: () => {
        toast("Payment checkout closed.", "info");
      }
    });

    handler.openIframe();
  };

  if (isLoadingListing) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
        <div className="flex flex-col items-center gap-4 text-center">
          <Icon name="loader" size={40} className="animate-spin text-brand-600" />
          <p className="text-slate-500 font-medium font-sans animate-pulse">Loading secure checkout...</p>
        </div>
      </div>
    );
  }

  if (!listing) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4 font-sans">
        <div className="bg-white p-8 rounded-3xl shadow-xl max-w-sm w-full text-center border border-slate-100">
          <div className="w-16 h-16 bg-rose-50 text-rose-500 rounded-full flex items-center justify-center mx-auto mb-4 border border-rose-100">
            <Icon name="alertTriangle" size={32} />
          </div>
          <h2 className="text-xl font-bold text-slate-900 mb-2 font-display">Listing Not Found</h2>
          <p className="text-slate-500 mb-6 text-sm">The property you are trying to pay for is unavailable or does not exist.</p>
          <button 
            onClick={() => navigate('/')}
            className="w-full py-3.5 bg-slate-900 text-white rounded-xl font-bold hover:bg-slate-800 transition-all font-sans"
          >
            Go back Home
          </button>
        </div>
      </div>
    );
  }

  if (isSuccess) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
        <div className="bg-white p-8 rounded-3xl shadow-xl max-w-sm w-full text-center border border-slate-100">
          <div className="w-20 h-20 bg-emerald-100 text-emerald-500 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner">
            <Icon name="check" size={40} />
          </div>
          <h2 className="text-2xl font-bold text-slate-900 mb-2 font-display">Payment Successful!</h2>
          <p className="text-slate-500 mb-8 font-medium">
            Your payment for <strong className="text-slate-700">{listing.title}</strong> has been confirmed securely.
          </p>
          <button 
            onClick={() => navigate('/')}
            className="w-full py-3.5 bg-slate-900 text-white rounded-xl font-bold hover:bg-slate-800 transition-all shadow-md active:scale-[0.98]"
          >
            Back to Home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50/80 p-4 font-sans">
      <div className="bg-white p-6 md:p-8 rounded-3xl shadow-2xl shadow-slate-200/50 max-w-md w-full border border-slate-100 relative overflow-hidden">
        <div className="absolute -top-24 -right-24 w-48 h-48 bg-brand-50 rounded-full blur-3xl opacity-50 pointer-events-none"></div>
        
        <div className="flex items-center gap-4 mb-6 relative z-10">
          <button onClick={() => navigate(-1)} className="p-2 bg-slate-50 hover:bg-slate-100 rounded-full text-slate-500 transition-all">
            <Icon name="arrowLeft" size={20} />
          </button>
          <h2 className="text-xl font-bold text-slate-900 font-display flex items-center gap-2">
             <Icon name="lock" size={18} className="text-brand-500" /> Secure Checkout
          </h2>
        </div>

        <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 mb-6 relative z-10">
          <div className="flex gap-4 items-center">
            <img src={listing.images?.[0] || listing.imageUrl} alt={listing.title} className="w-16 h-16 rounded-xl object-cover shadow-sm bg-white" />
            <div className="flex-1 min-w-0">
              <h3 className="font-bold text-slate-800 truncate leading-snug">{listing.title}</h3>
              <p className="text-xs text-slate-500 truncate mt-0.5">{listing.location}</p>
            </div>
          </div>
          <div className="flex justify-between items-center mt-4 pt-4 border-t border-slate-200">
            <span className="text-slate-500 font-medium text-sm">
              Total to Pay
              {paymentIntent && (
                <span className="block text-[10px] text-brand-600 font-bold uppercase tracking-wider mt-0.5">
                  {paymentIntent === 'promotion' ? '⚡ Premium Boost' : '🏠 Rent Deposit / Hold'}
                </span>
              )}
            </span>
            <span className="text-2xl font-black text-slate-900 tracking-tight font-display">
              {getSymbolFromCode(listing.currency || 'USD')}{priceToPay.toLocaleString()}
            </span>
          </div>
        </div>

        {!paymentIntent ? (
          <div className="space-y-4 relative z-10">
            <p className="text-sm font-semibold text-slate-700">What would you like to pay for?</p>
            
            {listing.sellerId === user.id ? (
              <button 
                onClick={() => setPaymentIntent('promotion')}
                className="w-full text-left p-4 border-2 border-brand-100 hover:border-brand-500 rounded-2xl bg-brand-50/30 hover:bg-brand-50 dynamic-transition flex items-start gap-3 group animate-fadeIn"
              >
                <div className="p-2 bg-brand-100 text-brand-600 rounded-xl group-hover:bg-brand-200 transition-colors">
                  <Icon name="trendingUp" size={20} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-baseline mb-0.5">
                    <h4 className="font-bold text-slate-800 text-sm">Promote Listing (Boost)</h4>
                    <span className="font-extrabold text-brand-600 text-sm">
                      {getSymbolFromCode(listing.currency || 'USD')}{getPremiumPrice(listing.currency || 'USD').toLocaleString()}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    Featured placement at the top of search terms, premium badge, and priority real-time WhatsApp and chat leads.
                  </p>
                </div>
              </button>
            ) : (
              <button 
                onClick={() => setPaymentIntent('deposit')}
                className="w-full text-left p-4 border-2 border-slate-100 hover:border-emerald-500 rounded-2xl bg-slate-50/50 hover:bg-emerald-55/10 dynamic-transition flex items-start gap-3 group animate-fadeIn"
              >
                <div className="p-2 bg-emerald-100 text-emerald-600 rounded-xl group-hover:bg-emerald-200 transition-colors">
                  <Icon name="creditCard" size={20} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-baseline mb-0.5">
                    <h4 className="font-bold text-slate-800 text-sm">Rent Deposit / Holding Fee</h4>
                    <span className="font-extrabold text-slate-900 text-sm">
                      {getSymbolFromCode(listing.currency || 'USD')}{listing.price.toLocaleString()}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    Submit first month's secure deposit or booking reservation fee to hold the unit immediately.
                  </p>
                </div>
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-4 relative z-10">
            <div className="bg-emerald-50/60 border border-emerald-200/60 rounded-2xl p-4 flex flex-col gap-1.5 shadow-none relative">
              <span className="absolute -top-2.5 right-4 px-2 py-0.5 bg-emerald-600 text-white font-black text-[8px] uppercase tracking-wider rounded-full shadow-xs">
                PRIMARY OPTION
              </span>
              <div className="flex items-center gap-1.5 text-emerald-800">
                <Icon name="shieldCheck" size={16} className="text-emerald-650" />
                <span className="font-extrabold text-xs uppercase tracking-wide">Instant Paystack Checkout</span>
              </div>
              <p className="text-[11px] text-emerald-700 leading-relaxed font-medium">
                Supports all debit/credit cards, bank payments, and mobile money (MTN Mobile Money, Telecel Cash, AirtelTigo Money). Secured and processed instantly.
              </p>
              
              <button 
                onClick={handlePaystackPayment}
                disabled={isProcessing}
                className="w-full py-3.5 mt-2 bg-emerald-600 text-white rounded-xl font-black hover:bg-emerald-750 active:scale-[0.98] transition-all shadow-md flex items-center justify-center gap-2 group disabled:opacity-70 disabled:cursor-wait text-sm"
              >
                {isProcessing ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Processing Secure Checkout...
                  </>
                ) : (
                  <>
                    <Icon name="shieldCheck" size={18} />
                    Pay with Paystack ({getSymbolFromCode(listing.currency || 'USD')}{priceToPay.toLocaleString()})
                  </>
                )}
              </button>
            </div>

            {import.meta.env.VITE_BANK_ACCOUNT_NO && import.meta.env.VITE_BANK_NAME && (
              <>
                <div className="relative my-4">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-slate-200"></div>
                  </div>
                  <div className="relative flex justify-center text-xs">
                    <span className="px-2 bg-white text-slate-400 font-medium uppercase tracking-widest">Or</span>
                  </div>
                </div>
                
                <button 
                  onClick={() => setShowBankDetails(!showBankDetails)}
                  className="w-full py-4 bg-slate-50 text-slate-700 rounded-xl font-bold border border-slate-200 hover:bg-slate-100 transition-all flex items-center justify-center gap-2 text-xs"
                >
                  <Icon name="creditCard" size={18} />
                  Manual Bank Transfer (Secondary)
                </button>
                
                {showBankDetails && (
                  <div className="mt-4 p-4 rounded-xl border border-blue-100 bg-blue-50 text-sm text-blue-900 animate-fade-in">
                    <p className="font-bold mb-2">Manual Transfer Details:</p>
                    <p className="mb-1"><strong>Bank:</strong> {import.meta.env.VITE_BANK_NAME}</p>
                    <p className="mb-1"><strong>Account Name:</strong> {import.meta.env.VITE_BANK_ACCOUNT_NAME || 'Tym2Muv LLC'}</p>
                    <p className="mb-1"><strong>Account No:</strong> {import.meta.env.VITE_BANK_ACCOUNT_NO}</p>
                    <p className="mt-3 text-xs text-blue-700">Please include reference: <strong>TYM-{listing.id.substring(0, 5).toUpperCase()}</strong></p>
                  </div>
                )}
              </>
            )}

            <button 
              onClick={() => setPaymentIntent(null)}
              className="w-full text-center text-xs font-semibold text-slate-400 hover:text-slate-600 transition-colors pt-2 block"
            >
              ← Choose another checkout plan
            </button>
          </div>
        )}
        
        {/* Row of recognizable payment provider icons to build trust */}
        <div className="mt-5 p-3 px-4 bg-slate-50/80 rounded-2xl border border-slate-100 flex flex-col items-center gap-2 relative z-10">
          <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none">Accepted Payment Providers</span>
          <div className="flex flex-wrap items-center justify-center gap-2">
            {/* Visa */}
            <div className="px-2 py-0.5 bg-white border border-slate-200/60 rounded shadow-xs flex items-center justify-center h-5">
              <span className="text-[10px] font-black italic text-blue-800 tracking-tighter">ViSA</span>
            </div>
            {/* Mastercard */}
            <div className="px-1.5 py-0.5 bg-white border border-slate-200/60 rounded shadow-xs flex items-center gap-1 h-5">
              <div className="flex -space-x-1 shrink-0">
                <div className="w-2 h-2 rounded-full bg-rose-500 opacity-90"></div>
                <div className="w-2 h-2 rounded-full bg-amber-500 opacity-90"></div>
              </div>
              <span className="text-[8px] font-black text-slate-600 tracking-tight">mastercard</span>
            </div>
            {/* MTN Mobile Money */}
            <div className="px-1.5 py-0.5 bg-[#FFCC00] rounded shadow-xs flex items-center justify-center h-5">
              <span className="text-[8px] font-black text-black tracking-tight shrink-0">MTN MoMo</span>
            </div>
            {/* Telecel Cash */}
            <div className="px-1.5 py-0.5 bg-[#E60000] text-white rounded shadow-xs flex items-center justify-center h-5">
              <span className="text-[8px] font-black tracking-tight shrink-0">telecel cash</span>
            </div>
            {/* AirtelTigo Money */}
            <div className="px-1.5 py-0.5 bg-[#00529B] text-white rounded shadow-xs flex items-center justify-center h-5">
              <span className="text-[8px] font-black tracking-tight shrink-0">airteltigo money</span>
            </div>
            {/* Paystack */}
            <div className="px-1.5 py-0.5 bg-white border border-slate-200/60 rounded shadow-xs flex items-center justify-center h-5">
              <span className="text-[8px] font-black text-[#00a3ff] tracking-tight">paystack</span>
            </div>
          </div>
        </div>

        <div className="mt-5 pt-3.5 border-t border-slate-100 text-center relative z-10">
           <p className="text-xs text-slate-400 flex items-center justify-center gap-1.5 font-medium">
             <Icon name="shieldCheck" size={14} className="text-emerald-500" />
             Payments secured by Paystack
           </p>
        </div>
      </div>
    </div>
  );
}

export default PaymentPage;
