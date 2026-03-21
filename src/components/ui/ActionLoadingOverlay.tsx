'use client';

import { MessageSquareMore } from "lucide-react";

export function ActionLoadingOverlay({
  visible,
  title,
  description,
}: {
  visible: boolean;
  title: string;
  description: string;
}) {
  if (!visible) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-[rgba(255,247,241,0.28)] backdrop-blur-md">
      <div className="glass-panel-strong loading-float w-[min(90vw,360px)] rounded-[24px] p-4 shadow-[0_22px_48px_rgba(110,91,140,0.22)] sm:w-[min(92vw,420px)] sm:rounded-[30px] sm:p-6">
        <div className="flex items-start gap-3 sm:gap-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[16px] bg-[linear-gradient(135deg,#ff8e6e,#b79cf5)] text-white shadow-[0_14px_30px_rgba(110,91,140,0.2)] sm:h-14 sm:w-14 sm:rounded-[20px]">
            <MessageSquareMore className="h-5 w-5 animate-pulse sm:h-6 sm:w-6" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-[#8b8594] sm:text-[11px] sm:tracking-[0.28em]">
              MineTally
            </p>
            <h2 className="mt-1.5 text-lg font-bold leading-tight text-[#2b2b2b] sm:mt-2 sm:text-2xl">{title}</h2>
            <p className="mt-1.5 text-[13px] leading-5 text-[#6b6b6b] sm:mt-2 sm:text-sm sm:leading-6">{description}</p>
          </div>
        </div>

        <div className="loading-line mt-4 h-1.5 rounded-full bg-white/30 sm:mt-6 sm:h-2">
          <div className="h-full w-full rounded-full bg-[linear-gradient(90deg,#ff8e6e,#b79cf5)] opacity-80" />
        </div>

        <div className="mt-4 space-y-2.5 sm:mt-5 sm:space-y-3">
          {[
            "Fetching batch comments",
            "Matching confirmed winners",
            "Refreshing buyer totals",
          ].map((step) => (
            <div key={step} className="glass-section flex items-center gap-2.5 rounded-[16px] p-2.5 sm:gap-3 sm:rounded-[18px] sm:p-3">
              <span className="h-2 w-2 rounded-full bg-[#8ecfb5] sm:h-2.5 sm:w-2.5" />
              <span className="text-[13px] font-medium text-[#514b59] sm:text-sm">{step}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
