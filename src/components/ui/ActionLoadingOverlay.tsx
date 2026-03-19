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
      <div className="glass-panel-strong loading-float w-[min(92vw,420px)] rounded-[30px] p-6 shadow-[0_22px_48px_rgba(110,91,140,0.22)]">
        <div className="flex items-start gap-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[20px] bg-[linear-gradient(135deg,#ff8e6e,#b79cf5)] text-white shadow-[0_14px_30px_rgba(110,91,140,0.2)]">
            <MessageSquareMore className="h-6 w-6 animate-pulse" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-bold uppercase tracking-[0.28em] text-[#8b8594]">
              MineTally
            </p>
            <h2 className="mt-2 text-2xl font-bold text-[#2b2b2b]">{title}</h2>
            <p className="mt-2 text-sm leading-6 text-[#6b6b6b]">{description}</p>
          </div>
        </div>

        <div className="loading-line mt-6 h-2 rounded-full bg-white/30">
          <div className="h-full w-full rounded-full bg-[linear-gradient(90deg,#ff8e6e,#b79cf5)] opacity-80" />
        </div>

        <div className="mt-5 space-y-3">
          {[
            "Fetching batch comments",
            "Matching confirmed winners",
            "Refreshing buyer totals",
          ].map((step) => (
            <div key={step} className="glass-section flex items-center gap-3 rounded-[18px] p-3">
              <span className="h-2.5 w-2.5 rounded-full bg-[#8ecfb5]" />
              <span className="text-sm font-medium text-[#514b59]">{step}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
