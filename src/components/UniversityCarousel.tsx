import React from 'react';
import { germanUniversities } from '../data/germanyUniversities';
import { ArrowUpRight, GraduationCap } from 'lucide-react';

export const UniversityCarousel: React.FC = () => {
  // Duplicate array to guarantee seamless, continuous infinite loop
  const duplicatedUniversities = [...germanUniversities, ...germanUniversities];

  return (
    <section className="py-20 sm:py-28 theme-bg-surface overflow-hidden border-y theme-border">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-12 sm:mb-16">
        <div className="max-w-3xl space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full theme-bg-card text-[#FFD21C] border theme-border text-xs font-mono font-bold uppercase tracking-wider">
            <GraduationCap className="w-3.5 h-3.5 text-[#FFD21C]" />
            <span>Academic Excellence & TU9 Engineering</span>
          </div>
          <h2 className="text-3xl sm:text-5xl font-black tracking-tight theme-text-main uppercase">
            GERMANY'S TOP UNIVERSITIES
          </h2>
          <p className="text-base sm:text-lg theme-text-muted font-normal leading-relaxed">
            World-class institutions with €0 tuition at state universities, globally recognized research, and direct industrial tie-ups with Siemens, BMW, and SAP.
          </p>
        </div>
      </div>

      {/* Infinite Horizontal Conveyor Belt Marquee Container */}
      <div className="relative w-full overflow-hidden select-none py-4">
        {/* Continuous Marquee Track */}
        <div className="animate-marquee flex gap-6 px-4">
          {duplicatedUniversities.map((uni, idx) => (
            <div
              key={`${uni.id}-${idx}`}
              className="w-[320px] sm:w-[360px] h-[220px] theme-bg-card rounded-2xl border theme-border shadow-md hover:shadow-xl hover:border-[#E30613] transition-all duration-300 flex flex-col justify-between overflow-hidden p-6 shrink-0 group cursor-pointer"
            >
              {/* Card Header with Image Thumbnail & Initials Badge */}
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-12 h-12 rounded-xl overflow-hidden shrink-0 theme-bg-surface border theme-border">
                    <img
                      src={uni.image}
                      alt={uni.shortName}
                      className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                      loading="lazy"
                    />
                  </div>
                  <div className="min-w-0">
                    <span className="text-[11px] font-mono font-extrabold px-2 py-0.5 rounded theme-bg-surface text-[#FFD21C] border theme-border">
                      {uni.initials}
                    </span>
                    <h3 className="text-sm font-black theme-text-main truncate mt-1 group-hover:text-[#E30613] transition-colors">
                      {uni.shortName}
                    </h3>
                  </div>
                </div>

                <div className="w-7 h-7 rounded-full theme-bg-surface group-hover:bg-[#E30613] theme-text-muted group-hover:text-white flex items-center justify-center shrink-0 transition-colors border theme-border">
                  <ArrowUpRight className="w-4 h-4" />
                </div>
              </div>

              {/* Focus Area & Location */}
              <div className="space-y-1">
                <div className="text-xs font-mono font-bold text-[#E30613] uppercase tracking-wide">
                  {uni.focus}
                </div>
                <div className="text-xs theme-text-muted">
                  {uni.city}, {uni.state} · {uni.country}
                </div>
              </div>

              {/* Quick Key Facts */}
              <div className="pt-2 border-t theme-border flex items-center justify-between text-[11px] font-mono theme-text-muted">
                <span>Tuition: €0 Public Contribution</span>
                <span className="text-emerald-500 font-bold">KMK H+ State Accredited</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
