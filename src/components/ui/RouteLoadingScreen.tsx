'use client';

import { Package } from "lucide-react";
import { useEffect, useState } from "react";

function SkeletonBlock({
  className,
}: {
  className?: string;
}) {
  return <div className={`loading-shimmer rounded-[18px] ${className ?? ""}`} />;
}

export function RouteLoadingScreen() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setVisible(true), 140);
    return () => window.clearTimeout(timer);
  }, []);

  if (!visible) {
    return null;
  }

  return (
    <div className="relative min-h-[calc(100vh-2.75rem)]">
      <div className="pointer-events-none absolute inset-0 rounded-[30px] bg-white/10 backdrop-blur-[2px]" />

      <div className="relative z-10 grid gap-4 sm:gap-6 lg:grid-cols-[1.6fr_0.95fr]">
        <div className="space-y-4 sm:space-y-6">
          <div className="space-y-3 sm:space-y-4">
            <SkeletonBlock className="h-4 w-28" />
            <SkeletonBlock className="h-10 w-60 max-w-full sm:h-12 sm:w-72" />
            <SkeletonBlock className="h-4 w-[28rem] max-w-full" />
          </div>

          <div className="grid gap-3 sm:grid-cols-2 sm:gap-5 xl:grid-cols-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="glass-panel rounded-[22px] p-4 sm:rounded-[26px] sm:p-6">
                <div className="flex items-center justify-between gap-3 sm:gap-4">
                  <div className="space-y-3 sm:space-y-4">
                    <SkeletonBlock className="h-3 w-28" />
                    <SkeletonBlock className="h-8 w-14 sm:h-9 sm:w-16" />
                  </div>
                  <div className="loading-shimmer h-10 w-10 rounded-[16px] sm:h-12 sm:w-12 sm:rounded-[20px]" />
                </div>
              </div>
            ))}
          </div>

          <div className="glass-panel rounded-[24px] p-4 sm:rounded-[28px] sm:p-6">
            <div className="mb-4 flex items-center justify-between gap-4 sm:mb-6">
              <div className="space-y-2.5 sm:space-y-3">
                <SkeletonBlock className="h-5 w-48 max-w-full sm:h-6 sm:w-56" />
                <SkeletonBlock className="h-4 w-80 max-w-full" />
              </div>
              <SkeletonBlock className="h-10 w-28 rounded-full" />
            </div>
            <div className="grid gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-4">
              {Array.from({ length: 4 }).map((_, index) => (
                <div key={index} className="glass-section rounded-[18px] p-3 sm:rounded-[22px] sm:p-4">
                  <SkeletonBlock className="h-3 w-20" />
                  <SkeletonBlock className="mt-4 h-8 w-14" />
                </div>
              ))}
            </div>
          </div>

          <div className="glass-panel rounded-[24px] p-4 sm:rounded-[28px] sm:p-6">
            <div className="mb-4 flex items-center justify-between sm:mb-6">
              <SkeletonBlock className="h-5 w-44 max-w-full sm:h-6 sm:w-52" />
              <SkeletonBlock className="h-4 w-20" />
            </div>
            <div className="space-y-3 sm:space-y-4">
              {Array.from({ length: 5 }).map((_, index) => (
                <div key={index} className="glass-section flex items-center gap-3 rounded-[18px] p-3 sm:gap-4 sm:rounded-[22px] sm:p-4">
                  <SkeletonBlock className="h-10 w-10 rounded-[14px] sm:h-12 sm:w-12 sm:rounded-[16px]" />
                  <div className="min-w-0 flex-1 space-y-3">
                    <SkeletonBlock className="h-4 w-40 max-w-full" />
                    <SkeletonBlock className="h-3 w-64 max-w-full" />
                  </div>
                  <div className="space-y-3">
                    <SkeletonBlock className="h-4 w-16" />
                    <SkeletonBlock className="h-3 w-24" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="relative min-h-[420px] lg:min-h-0">
          <div className="pointer-events-none fixed inset-x-0 top-1/2 z-20 flex -translate-y-1/2 justify-center px-4 sm:pointer-events-auto sm:absolute sm:inset-x-auto sm:top-auto sm:z-auto sm:block sm:translate-y-0 lg:static">
            <div className="loading-float glass-panel-strong w-[min(90vw,320px)] rounded-[24px] p-4 sm:sticky sm:top-8 sm:max-w-[360px] sm:rounded-[30px] sm:p-6">
            <div className="mb-4 flex items-start gap-3 sm:mb-6 sm:gap-4">
              <div className="flex h-11 w-11 items-center justify-center rounded-[16px] bg-[linear-gradient(135deg,#ff8e6e,#b79cf5)] text-white shadow-[0_14px_30px_rgba(110,91,140,0.2)] sm:h-14 sm:w-14 sm:rounded-[20px]">
                <Package className="h-5 w-5 sm:h-6 sm:w-6" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-[#8b8594] sm:text-[11px] sm:tracking-[0.28em]">
                  MineTally
                </p>
                <h2 className="mt-1.5 text-lg font-bold leading-tight text-[#2b2b2b] sm:mt-2 sm:text-2xl">
                  Preparing your workspace
                </h2>
                <p className="mt-1.5 text-[13px] leading-5 text-[#6b6b6b] sm:mt-2 sm:text-sm">
                  Syncing layout, metrics, and collections for the next view.
                </p>
              </div>
            </div>

            <div className="loading-line h-1.5 rounded-full bg-white/30 sm:h-2">
              <div className="h-full w-full rounded-full bg-[linear-gradient(90deg,#ff8e6e,#b79cf5)] opacity-80" />
            </div>

            <div className="mt-4 space-y-2.5 sm:mt-6 sm:space-y-3">
              {["Loading dashboard modules", "Resolving collection data", "Polishing card layout"].map((label) => (
                <div key={label} className="glass-section flex items-center gap-2.5 rounded-[16px] p-2.5 sm:gap-3 sm:rounded-[18px] sm:p-3">
                  <span className="h-2 w-2 rounded-full bg-[#8ecfb5] sm:h-2.5 sm:w-2.5" />
                  <span className="text-[13px] font-medium text-[#514b59] sm:text-sm">{label}</span>
                </div>
              ))}
            </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
