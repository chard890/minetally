import { cn } from "@/lib/utils";

const VARIANT_STYLES = {
  slate: "bg-slate-50 text-slate-600 ring-slate-200 border-slate-200",
  emerald: "bg-emerald-50 text-emerald-700 ring-emerald-100 border-emerald-100",
  amber: "bg-amber-50 text-amber-700 ring-amber-100 border-amber-100",
  indigo: "bg-indigo-50 text-indigo-700 ring-indigo-100 border-indigo-100",
  blue: "bg-blue-50 text-blue-700 ring-blue-100 border-blue-100",
  rose: "bg-rose-50 text-rose-700 ring-rose-100 border-rose-100",
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
        "inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ring-1",
        VARIANT_STYLES[variant],
        className,
      )}
    >
      {label}
    </span>
  );
}
