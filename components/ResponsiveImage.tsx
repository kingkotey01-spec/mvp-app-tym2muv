import React, { useRef, useState, useEffect } from 'react';
import { getOptimizedImageUrl } from '../utils/imageOptimization';

interface ResponsiveImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  src?: string | null;
  fallbackSrc?: string;
  generateSrcSet?: boolean;
}

const FALLBACK_URI =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 3 2'%3E%3C/svg%3E";

const ResponsiveImage: React.FC<ResponsiveImageProps> = ({
  src,
  fallbackSrc,
  generateSrcSet = true,
  className = '',
  ...props
}) => {
  const imgRef = useRef<HTMLImageElement>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    if (!imgRef.current) return;
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsVisible(true);
            if (imgRef.current) observer.unobserve(imgRef.current);
          }
        });
      },
      { rootMargin: '200px' }
    );
    observer.observe(imgRef.current);
    return () => observer.disconnect();
  }, []);

  const targetSrc = src || fallbackSrc || FALLBACK_URI;

  // Tiny low-resolution URL for dynamic blur-up
  const lowResPlaceholder = src && src.includes('unsplash.com') 
    ? src.replace(/w=\d+/, 'w=40').replace(/q=\d+/, 'q=20') 
    : src && src.includes('supabase.co/storage') 
      ? getOptimizedImageUrl(src, { width: 40 }) 
      : FALLBACK_URI;

  // Show placeholder while not in view
  if (!isVisible) {
    return (
      <img
        ref={imgRef}
        src={FALLBACK_URI}
        className={`${className} bg-slate-200 animate-pulse`}
        loading="lazy"
        {...props}
        alt={props.alt ?? ''}
      />
    );
  }

  const optimizedSrc = getOptimizedImageUrl(targetSrc, { width: 800 });

  // Build srcSet only for Supabase Storage URLs (they support width transform params)
  const srcSet =
    generateSrcSet && src && src.includes('supabase.co/storage')
      ? [
          `${getOptimizedImageUrl(src, { width: 400 })} 400w`,
          `${getOptimizedImageUrl(src, { width: 800 })} 800w`,
          `${getOptimizedImageUrl(src, { width: 1200 })} 1200w`,
        ].join(', ')
      : undefined;

  return (
    <div className={`relative overflow-hidden ${className}`}>
      {/* Blurred Low-Res Placeholder background */}
      {!isLoaded && !hasError && (
        <img
          src={lowResPlaceholder}
          className="absolute inset-0 w-full h-full object-cover blur-md scale-105 select-none pointer-events-none transition-all duration-300"
          alt=""
          referrerPolicy="no-referrer"
        />
      )}

      {/* Main High-Res Image with seamless CSS transition */}
      <img
        ref={imgRef}
        src={hasError ? fallbackSrc || FALLBACK_URI : optimizedSrc}
        srcSet={hasError ? undefined : srcSet}
        onLoad={() => setIsLoaded(true)}
        onError={(e) => {
          setHasError(true);
          if (fallbackSrc) {
            (e.target as HTMLImageElement).src = fallbackSrc;
          }
        }}
        loading="lazy"
        className={`w-full h-full object-cover transition-all duration-500 ease-out ${
          isLoaded ? 'opacity-100 scale-100' : 'opacity-0 scale-[1.01]'
        }`}
        {...props}
      />
    </div>
  );
};

export default ResponsiveImage;

