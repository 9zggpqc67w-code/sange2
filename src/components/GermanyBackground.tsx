import React, { useState, useEffect } from 'react';
import { germanyBackgroundImages, GermanyBackgroundImage } from '../data/germanyBackgrounds';
import { useTheme } from '../theme/ThemeContext';

interface GermanyBackgroundProps {
  intervalMs?: number; // default 6000ms (6 seconds)
}

export const GermanyBackground: React.FC<GermanyBackgroundProps> = ({
  intervalMs = 6000,
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [images] = useState<GermanyBackgroundImage[]>(germanyBackgroundImages);
  const [failedImages, setFailedImages] = useState<Record<string, boolean>>({});
  const { resolvedTheme } = useTheme();

  useEffect(() => {
    if (images.length <= 1) return;

    const timer = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % images.length);
    }, intervalMs);

    return () => clearInterval(timer);
  }, [images.length, intervalMs]);

  const handleImageError = (id: string) => {
    setFailedImages((prev) => ({ ...prev, [id]: true }));
  };

  const currentImage = images[currentIndex];
  const isLight = resolvedTheme === 'light';

  return (
    <div
      className="absolute inset-0 pointer-events-none overflow-hidden select-none"
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', overflow: 'hidden' }}
    >
      {/* Fallback architectural gradient background */}
      <div className="absolute inset-0 bg-[#050505]" />

      {/* Rotating Background Images - Clear, HD, cinematic */}
      {images.map((img, idx) => {
        const isActive = idx === currentIndex;
        const isFailed = failedImages[img.id];

        if (isFailed) return null;

        return (
          <div
            key={img.id}
            className={`absolute inset-0 transition-opacity duration-1000 ease-in-out ${
              isActive ? 'opacity-100' : 'opacity-0'
            }`}
          >
            <img
              src={img.url}
              alt={img.alt}
              onError={() => handleImageError(img.id)}
              className="w-full h-full object-cover object-center scale-105 transition-transform duration-10000 ease-linear"
            />
          </div>
        );
      })}

      {/* Subtle dark overlay only where necessary to maintain text readability without making it too dark */}
      <div className="absolute inset-0 bg-gradient-to-r from-[#050505]/80 via-[#050505]/45 to-[#050505]/15" />
      <div className="absolute inset-0 bg-gradient-to-t from-[#050505]/85 via-transparent to-[#050505]/35" />

      {/* Landmark Indicator in Bottom Left */}
      {currentImage && !failedImages[currentImage.id] && (
        <div
          className="absolute bottom-5 left-6 z-10 hidden md:flex items-center gap-2.5 text-[11px] font-mono font-medium tracking-wide px-3.5 py-1.5 rounded-full backdrop-blur-md border shadow-xl bg-[#050505]/80 text-[#E8E8E8] border-white/15"
        >
          <span className="w-2 h-2 rounded-full bg-[#FFD21C] animate-pulse shadow-[0_0_8px_#FFD21C]" />
          <span className="font-bold text-white">{currentImage.title}</span>
          <span className="opacity-30 text-white/50">/</span>
          <span className="text-neutral-300">{currentImage.location}</span>
        </div>
      )}
    </div>
  );
};
