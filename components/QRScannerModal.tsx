import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Icon from './Icon';
import { Listing } from '../types';
import { getListings } from '../services/supabaseService';
import { useNavigate } from 'react-router-dom';
import { useToast } from './Toast';

interface QRScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const QRScannerModal: React.FC<QRScannerModalProps> = ({ isOpen, onClose }) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const navigate = useNavigate();
  const { toast } = useToast();

  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [isCameraActive, setIsCameraActive] = useState<boolean>(false);
  const [cameraError, setCameraError] = useState<string>('');
  const [demoListings, setDemoListings] = useState<Listing[]>([]);
  const [scannedListing, setScannedListing] = useState<Listing | null>(null);
  const [isScanningActive, setIsScanningActive] = useState<boolean>(true);

  // Load demo listings to let the user "scan" in simulated sandboxed browser
  useEffect(() => {
    const fetchDemos = async () => {
      try {
        const { listings } = await getListings({ limit: 6 });
        setDemoListings(listings);
      } catch (err) {
        console.warn("Failed to load demo listings for QR scanner simulation:", err);
      }
    };
    fetchDemos();
  }, []);

  const startCamera = async () => {
    setCameraError('');
    try {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' }
      });
      
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.setAttribute('playsinline', 'true');
        videoRef.current.play();
      }
      setHasPermission(true);
      setIsCameraActive(true);
    } catch (err: any) {
      console.warn("Camera failed to start:", err);
      setHasPermission(false);
      setIsCameraActive(false);
      setCameraError(err.message || 'Unable to access camera. Please confirm camera permissions or explore the simulated list below.');
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsCameraActive(false);
  };

  useEffect(() => {
    if (isOpen) {
      startCamera();
      setIsScanningActive(true);
      setScannedListing(null);
    } else {
      stopCamera();
    }
    return () => stopCamera();
  }, [isOpen]);

  const handleSimulateScan = (listing: Listing) => {
    setIsScanningActive(false);
    setScannedListing(listing);
    toast(`Successfully scanned QR Code for ${listing.title}!`, 'success');
  };

  const handleResetScan = () => {
    setScannedListing(null);
    setIsScanningActive(true);
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="bg-white max-w-2xl w-full rounded-[2rem] overflow-hidden shadow-2xl relative flex flex-col max-h-[90vh]"
        >
          {/* Header */}
          <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-brand-50 text-brand-600 flex items-center justify-center">
                <Icon name="camera" size={16} />
              </div>
              <div>
                <h3 className="text-sm font-black text-slate-800 leading-tight">Instant QR Code Scanner</h3>
                <p className="text-[10px] text-slate-500 font-medium">Scan property QR labels to view details and agent info</p>
              </div>
            </div>
            <button 
              onClick={() => { stopCamera(); onClose(); }}
              className="w-8 h-8 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-600 transition-colors"
            >
              <Icon name="x" size={20} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6">
            {/* Live Camera Grid Section */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
              
              {/* Camera Frame */}
              <div className="space-y-2">
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider block">Live Lens Scan</span>
                <div className="relative aspect-square rounded-2xl overflow-hidden bg-slate-950 border border-slate-800 flex flex-col items-center justify-center text-center p-4 shadow-inner">
                  
                  {isCameraActive && isScanningActive && !scannedListing && (
                    <video 
                      ref={videoRef}
                      className="absolute inset-0 w-full h-full object-cover"
                      muted
                      playsInline
                    />
                  )}

                  {/* Scanning HUD Overlays */}
                  {isCameraActive && isScanningActive && (
                    <>
                      <div className="absolute inset-0 pointer-events-none border-[16px] border-black/40" />
                      {/* Interactive Aim Reticle */}
                      <div className="absolute w-44 h-44 pointer-events-none flex flex-col justify-between">
                        <div className="flex justify-between">
                          <div className="w-6 h-6 border-t-4 border-l-4 border-brand-500 rounded-tl-md" />
                          <div className="w-6 h-6 border-t-4 border-r-4 border-brand-500 rounded-tr-md" />
                        </div>
                        <div className="flex justify-between">
                          <div className="w-6 h-6 border-b-4 border-l-4 border-brand-500 rounded-bl-md" />
                          <div className="w-6 h-6 border-b-4 border-r-4 border-brand-500 rounded-br-md" />
                        </div>
                      </div>

                      {/* Moving laser guides */}
                      <motion.div 
                        initial={{ top: '15%' }}
                        animate={{ top: '85%' }}
                        transition={{ duration: 2, repeat: Infinity, repeatType: 'reverse', ease: 'linear' }}
                        className="absolute left-[15%] right-[15%] h-1 bg-brand-500/80 shadow-[0_0_8px_rgb(234,88,12)] z-10 pointer-events-none"
                      />
                    </>
                  )}

                  {/* Permission / Status states */}
                  {!isCameraActive && (
                    <div className="space-y-3 p-4 z-10">
                      <div className="w-12 h-12 rounded-full bg-slate-900 text-slate-500 flex items-center justify-center mx-auto border border-slate-850">
                        <Icon name="camera" size={24} />
                      </div>
                      <p className="text-xs font-bold text-slate-300">Camera Access Pending</p>
                      <p className="text-[10px] text-slate-400 max-w-sm ml-auto mr-auto">
                        We require standard video media devices to decode codes via your device camera.
                      </p>
                      <button 
                        onClick={startCamera}
                        className="px-4 py-1.5 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-[10px] font-bold transition-all"
                      >
                        Grant Permissions / Retry Camera
                      </button>
                    </div>
                  )}

                  {cameraError && (
                    <div className="absolute inset-0 bg-slate-950/90 flex flex-col items-center justify-center p-6 text-center z-20 space-y-3">
                      <div className="w-10 h-10 rounded-full bg-red-950/50 text-red-500 flex items-center justify-center">
                        <Icon name="alert" size={20} />
                      </div>
                      <h4 className="text-xs font-bold text-slate-100">Camera Permission Blocked</h4>
                      <p className="text-[9px] text-slate-400 leading-relaxed">
                        To resolve, please click the lock/settings icon in your browser URL bar, enable Camera access, and refresh. You can still scan instantly using our simulation list!
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Scanned Feedback and Demo QR selectors */}
              <div className="space-y-4">
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider block">Decoded Feed</span>
                
                {scannedListing ? (
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="p-4 bg-emerald-50/50 border border-emerald-100 rounded-2xl space-y-3.5"
                  >
                    <div className="flex items-start gap-3">
                      <img 
                        src={scannedListing.imageUrl || scannedListing.images?.[0] || 'https://images.unsplash.com/photo-1518780664697-55e3ad937233?w=200&h=200&fit=crop'} 
                        alt={scannedListing.title} 
                        className="w-14 h-14 object-cover rounded-lg border border-emerald-200"
                        referrerPolicy="no-referrer"
                      />
                      <div className="min-w-0">
                        <span className="inline-block px-1.5 py-0.5 bg-emerald-100/70 text-emerald-800 text-[8px] font-black uppercase rounded mb-1">Decoded QR Success</span>
                        <h4 className="text-xs font-black text-slate-900 truncate leading-snug">{scannedListing.title}</h4>
                        <p className="text-[10px] text-slate-500 font-bold truncate mt-0.5">{scannedListing.location}</p>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          stopCamera();
                          onClose();
                          navigate(`/listing/${scannedListing.id}`);
                        }}
                        className="flex-1 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-3xs font-black uppercase tracking-wider rounded-lg transition-colors flex items-center justify-center gap-1 shadow-sm"
                      >
                        <Icon name="external" size={10} />
                        <span>Navigate To Property</span>
                      </button>
                      <button
                        onClick={handleResetScan}
                        className="px-2.5 py-1.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 text-3xs font-black uppercase tracking-wider rounded-lg transition-colors"
                      >
                        Scan Next
                      </button>
                    </div>
                  </motion.div>
                ) : (
                  <div className="p-4 bg-slate-50 border border-slate-100 rounded-2xl flex flex-col items-center justify-center text-center py-7 text-slate-400 space-y-1.5">
                    <Icon name="loader" size={16} className="animate-spin text-brand-600" />
                    <p className="text-[10px] font-bold text-slate-650">Awaiting QR scanner capture...</p>
                    <p className="text-[9px] text-slate-400">Aim your camera at any tym2muv QR code, or click one of the tags below to simulate.</p>
                  </div>
                )}

                {/* Preconfigured Listing QRs */}
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider block">Scan Simulation List</span>
                    <span className="text-[8px] text-slate-400 font-bold">Use for testing preview</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {demoListings.map((demo) => (
                      <button
                        key={demo.id}
                        type="button"
                        onClick={() => handleSimulateScan(demo)}
                        className="p-2 border border-slate-100 bg-white hover:bg-slate-50 hover:border-slate-200 rounded-xl text-left transition-all flex items-center gap-2 group cursor-pointer"
                      >
                        <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center shrink-0 border border-slate-200/50 group-hover:bg-brand-50 transition-colors">
                          <svg className="w-4 h-4 text-slate-600 group-hover:text-brand-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h2M4 8h16" />
                          </svg>
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-[9px] font-black text-slate-800 truncate leading-none group-hover:text-brand-600 transition-colors">{demo.title}</p>
                          <p className="text-[7px] text-slate-450 truncate mt-0.5 font-bold uppercase tracking-wider">{demo.type}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

              </div>
            </div>
            
            {/* Explanatory Footer */}
            <div className="bg-slate-55 bg-indigo-50/50 rounded-2xl border border-indigo-100/50 p-3.5 flex items-start gap-2.5">
              <Icon name="info" size={14} className="text-indigo-600 mt-0.5 shrink-0" />
              <p className="text-[9px] text-slate-600 font-medium leading-relaxed">
                <span className="font-bold text-indigo-700">How scans work:</span> Every property detail screen features a downloadable QR code block containing direct links. Agents can post this QR label directly outside real-world properties, allowing prospective tenants to instantly unlock accurate interior specifications, safety indicators, price conversion models, and chat features.
              </p>
            </div>

          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
