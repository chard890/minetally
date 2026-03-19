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

      <div className="relative z-10 grid gap-6 lg:grid-cols-[1.6fr_0.95fr]">
        <div className="space-y-6">
          <div className="space-y-4">
            <SkeletonBlock className="h-4 w-28" />
            <SkeletonBlock className="h-12 w-72 max-w-full" />
            <SkeletonBlock className="h-4 w-[28rem] max-w-full" />
          </div>

          <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="glass-panel rounded-[26px] p-6">
                <div className="flex items-center justify-between gap-4">
                  <div className="space-y-4">
                    <SkeletonBlock className="h-3 w-28" />
                    <SkeletonBlock className="h-9 w-16" />
                  </div>
                  <div className="loading-shimmer h-12 w-12 rounded-[20px]" />
                </div>
              </div>
            ))}
          </div>

          <div className="glass-panel rounded-[28px] p-6">
            <div className="mb-6 flex items-center justify-between gap-4">
              <div className="space-y-3">
                <SkeletonBlock className="h-6 w-56 max-w-full" />
                <SkeletonBlock className="h-4 w-80 max-w-full" />
              </div>
              <SkeletonBlock className="h-10 w-28 rounded-full" />
            </div>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {Array.from({ length: 4 }).map((_, index) => (
                <div key={index} className="glass-section rounded-[22px] p-4">
                  <SkeletonBlock className="h-3 w-20" />
                  <SkeletonBlock className="mt-4 h-8 w-14" />
                </div>
              ))}
            </div>
          </div>

          <div className="glass-panel rounded-[28px] p-6">
            <div className="mb-6 flex items-center justify-between">
              <SkeletonBlock className="h-6 w-52 max-w-full" />
              <SkeletonBlock className="h-4 w-20" />
            </div>
            <div className="space-y-4">
              {Array.from({ length: 5 }).map((_, index) => (
                <div key={index} className="glass-section flex items-center gap-4 rounded-[22px] p-4">
                  <SkeletonBlock className="h-12 w-12 rounded-[16px]" />
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

        <div className="relative min-h-[420px]">
          <div className="loading-float glass-panel-strong sticky top-8 mx-auto max-w-[360px] rounded-[30px] p-6">
            <div className="mb-6 flex items-start gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-[20px] bg-[linear-gradient(135deg,#ff8e6e,#b79cf5)] text-white shadow-[0_14px_30px_rgba(110,91,140,0.2)]">
                <Package className="h-6 w-6" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-bold uppercase tracking-[0.28em] text-[#8b8594]">
                  MineTally
                </p>
                <h2 className="mt-2 text-2xl font-bold text-[#2b2b2b]">
                  Preparing your workspace
                </h2>
                <p className="mt-2 text-sm text-[#6b6b6b]">
                  Syncing layout, metrics, and collections for the next view.
                </p>
              </div>
            </div>

            <div className="loading-line h-2 rounded-full bg-white/30">
              <div className="h-full w-full rounded-full bg-[linear-gradient(90deg,#ff8e6e,#b79cf5)] opacity-80" />
            </div>

            <div className="mt-6 space-y-3">
              {["Loading dashboard modules", "Resolving collection data", "Polishing card layout"].map((label) => (
                <div key={label} className="glass-section flex items-center gap-3 rounded-[18px] p-3">
                  <span className="h-2.5 w-2.5 rounded-full bg-[#8ecfb5]" />
                  <span className="text-sm font-medium text-[#514b59]">{label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
