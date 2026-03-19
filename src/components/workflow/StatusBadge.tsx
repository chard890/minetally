import { cn } from "@/lib/utils";

const VARIANT_STYLES = {
  slate: "border-white/55 bg-white/58 text-[#66606f] ring-white/45",
  emerald: "border-[#bfe6d4] bg-[#eef9f3] text-[#3c8265] ring-[#d8f1e4]",
  amber: "border-[#ffd8bd] bg-[#fff1e6] text-[#b96d3d] ring-[#ffe8d8]",
  indigo: "border-[#dccdfb] bg-[#f3edff] text-[#7a62b7] ring-[#ece2ff]",
  blue: "border-[#d6e2ff] bg-[#edf3ff] text-[#5577b9] ring-[#e8efff]",
  rose: "border-[#f6c8d8] bg-[#fff0f5] text-[#bd5b84] ring-[#ffe3ee]",
} as const;

type Variant = keyof typeof VARIANT_STYLES;

interface StatusBadgeProps {
  label: string;
  variant?: Variant;
  className?: string;
}

export function StatusBadge({
  label,
  variant = "slate",
  className,
}: StatusBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] ring-1",
        VARIANT_STYLES[variant],
        className,
      )}
    >
      {label}
    </span>
  );
}
