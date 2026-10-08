import React, { useState } from 'react';
import { MapPin, Sparkles } from 'lucide-react';

export interface HeroCarouselImage {
  id: string;
  city: string;
  landmark: string;
  category: string;
  url: string;
  fallbackGradient: string;
}

const heroCarouselImages: HeroCarouselImage[] = [
  {
    id: 'berlin-gate',
    city: 'Berlin',
    landmark: 'Brandenburg Gate & Historic Pariser Platz',
    category: 'Capital & Federal Hub',
    url: 'https://images.unsplash.com/photo-1560969184-10fe8719e047?q=80&w=1200&auto=format&fit=crop',
    fallbackGradient: 'from-neutral-900 via-neutral-800 to-black',
  },
  {
    id: 'munich-skyline',
    city: 'Munich',
    landmark: 'Marienplatz & Bavarian Tech Corridor (TUM/LMU)',
    category: 'Innovation & TU9 Excellence',
    url: 'https://images.unsplash.com/photo-1595867818082-083862f3d630?q=80&w=1200&auto=format&fit=crop',
    fallbackGradient: 'from-amber-950/80 via-neutral-900 to-black',
  },
  {
    id: 'heidelberg-town',
    city: 'Heidelberg',
    landmark: 'Historic University Old Town & Neckar River',
    category: 'Oldest German University (1386)',
    url: 'https://images.unsplash.com/photo-1527866959252-deab85ef7d1b?q=80&w=1200&auto=format&fit=crop',
    fallbackGradient: 'from-red-950/70 via-neutral-900 to-black',
  },
  {
    id: 'aachen-rwth',
    city: 'Aachen',
    landmark: 'RWTH Aachen SuperC & Engineering Campus',
    category: 'Engineering & Tech Capital',
    url: 'https://images.unsplash.com/photo-1562774053-701939374585?q=80&w=1200&auto=format&fit=crop',
    fallbackGradient: 'from-blue-950/70 via-neutral-900 to-black',
  },
  {
    id: 'hamburg-harbor',
    city: 'Hamburg',
    landmark: 'Elbphilharmonie & Maritime Innovation Harbor',
    category: 'Northern Tech & Port Metropolis',
    url: '/hamburg.jpg',
    fallbackGradient: 'from-slate-900 via-neutral-900 to-black',
  },
  {
    id: 'frankfurt-skyline',
    city: 'Frankfurt am Main',
    landmark: 'Main River Skyline & Goethe University Campus',
    category: 'European Financial & AI Epicenter',
    url: '/frankfurt.jpg',
    fallbackGradient: 'from-emerald-950/70 via-neutral-900 to-black',
  },
  {
    id: 'campus-research',
    city: 'Bavaria & Baden',
    landmark: 'Modern German Technical Research Library & Labs',
    category: 'Excellence Initiative Universities',
    url: 'https://images.unsplash.com/photo-1541339907198-e08756dedf3f?q=80&w=1200&auto=format&fit=crop',
    fallbackGradient: 'from-purple-950/70 via-neutral-900 to-black',
  },
];

export const GermanyHeroCarousel: React.FC = () => {
  const [failedImages, setFailedImages] = useState<Record<string, boolean>>({});

  // Duplicate for seamless, uninterrupted infinite horizontal loop
  const seamlessImages = [...heroCarouselImages, ...heroCarouselImages];

  const handleImageError = (id: string) => {
    setFailedImages((prev) => ({ ...prev, [id]: true }));
  };

  return (
    <div className="relative w-full overflow-hidden rounded-3xl theme-border border theme-bg-card shadow-2xl group">
      {/* Top Header Micro Bar with German Red & Warm Gold accents */}
      <div className="px-4 py-2.5 border-b theme-border flex items-center justify-between theme-bg-surface backdrop-blur-md">
        <div className="flex items-center gap-2">
          {/* German Tri-color micro chip */}
          <div className="flex items-center h-2.5 w-6 rounded-xs overflow-hidden shadow-xs">
            <span className="w-2 h-full bg-[#050505]" />
            <span className="w-2 h-full bg-[#E30613]" />
            <span className="w-2 h-full bg-[#FFD21C]" />
          </div>
          <span className="text-[11px] font-mono font-bold tracking-wider theme-text-muted uppercase">
            Germany Destinations
          </span>
        </div>

        <div className="flex items-center gap-1.5 text-[10px] font-mono text-[#FFD21C] font-semibold theme-bg-subtle px-2 py-0.5 rounded-full border theme-border">
          <Sparkles className="w-3 h-3" />
          <span>Live Panorama</span>
        </div>
      </div>

      {/* Continuous horizontal scrolling container */}
      <div className="overflow-hidden py-3">
        <div className="animate-hero-slide gap-4 px-2">
          {seamlessImages.map((item, index) => {
            const isFailed = failedImages[item.id];

            return (
              <div
                key={`${item.id}-${index}`}
                className="relative w-[280px] sm:w-[320px] h-[360px] sm:h-[400px] shrink-0 rounded-2xl overflow-hidden theme-border border group/card shadow-xl transition-transform duration-300 hover:scale-[1.01]"
              >
                {/* Image with fallback handling */}
                {!isFailed ? (
                  <img
                    src={item.url}
                    alt={`${item.city} - ${item.landmark}`}
                    onError={() => handleImageError(item.id)}
                    loading="lazy"
                    className="w-full h-full object-cover object-center transition-transform duration-700 group-hover/card:scale-105"
                  />
                ) : (
                  /* Elegant fallback gradient */
                  <div
                    className={`w-full h-full bg-gradient-to-br ${item.fallbackGradient} flex flex-col justify-end p-5 text-white`}
                  >
                    <div className="text-2xl font-black text-[#FFD21C]">{item.city}</div>
                    <div className="text-xs text-neutral-300 font-mono mt-1">
                      {item.landmark}
                    </div>
                  </div>
                )}

                {/* Controlled bottom dark gradient ONLY for caption readability */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/35 to-transparent pointer-events-none" />

                {/* Top Corner Badge: City & Category */}
                <div className="absolute top-3 left-3 right-3 flex items-center justify-between pointer-events-none">
                  <span className="px-2.5 py-1 rounded-lg bg-black/75 backdrop-blur-md text-[11px] font-mono font-bold text-white border border-white/15 flex items-center gap-1.5 shadow-md">
                    <MapPin className="w-3 h-3 text-[#FFD21C]" />
                    <span>{item.city}</span>
                  </span>

                  <span className="px-2 py-0.5 rounded-md bg-[#E30613]/90 text-[10px] font-mono font-bold text-white uppercase tracking-wider shadow-md">
                    DE 🇩🇪
                  </span>
                </div>

                {/* Bottom Information Overlay */}
                <div className="absolute bottom-0 inset-x-0 p-4 space-y-1 text-white">
                  <span className="text-[10px] font-mono font-bold tracking-wider text-[#FFD21C] uppercase block">
                    {item.category}
                  </span>
                  <h4 className="text-sm sm:text-base font-black leading-snug line-clamp-2 drop-shadow-sm">
                    {item.landmark}
                  </h4>
                  <div className="pt-1 flex items-center gap-1.5 text-[10px] text-neutral-300 font-mono">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    <span>Public University Hub</span>
                  </div>
                </div>

                {/* Subtle border highlight on hover */}
                <div className="absolute inset-0 rounded-2xl ring-1 ring-inset ring-white/10 group-hover/card:ring-[#FFD21C]/40 transition-all pointer-events-none" />
              </div>
            );
          })}
        </div>
      </div>

      {/* Footer bar with Pause-on-hover indicator */}
      <div className="px-4 py-2 theme-bg-surface border-t theme-border flex items-center justify-between text-[11px] font-mono theme-text-muted">
        <div className="flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-[#E30613]" />
          <span>Smooth 16s linear loop</span>
        </div>
        <span className="theme-text-muted opacity-80 hidden sm:inline">
          Hover to pause carousel
        </span>
      </div>
    </div>
  );
};
