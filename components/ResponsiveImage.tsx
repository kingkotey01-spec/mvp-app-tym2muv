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
  className,
  ...props
}) => {
  const imgRef = useRef<HTMLImageElement>(null);
  const [isVisible, setIsVisible] = useState(false);

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
      { rootMargin: '100px' }
    );
    observer.observe(imgRef.current);
    return () => observer.disconnect();
  }, []);

  const targetSrc = src || fallbackSrc || FALLBACK_URI;

  // Show placeholder while not in view
  if (!isVisible) {
    return (
      <img
        ref={imgRef}
        src={FALLBACK_URI}
        className={`${className ?? ''} bg-slate-200 animate-pulse`}
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
    <img
      ref={imgRef}
      src={optimizedSrc}
      srcSet={srcSet}
      className={className}
      onError={(e) => {
        if (fallbackSrc) {
          (e.target as HTMLImageElement).src = fallbackSrc;
        }
      }}
      loading="lazy"
      {...props}
    />
  );
};

export default ResponsiveImage;
