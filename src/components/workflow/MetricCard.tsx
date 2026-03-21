import { LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/Card";

interface MetricCardProps {
  label: string;
  value: string | number;
  icon: LucideIcon;
  colorClass: string;
  backgroundClass: string;
  helperText?: string;
}

export function MetricCard({
  label,
  value,
  icon: Icon,
  colorClass,
  backgroundClass,
  helperText,
}: MetricCardProps) {
  return (
    <Card className="card-hover border-0">
      <CardContent className="!p-2.5 sm:!p-3.5">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-[9px] font-semibold uppercase tracking-[0.18em] text-[#8b8594] sm:text-[10px] sm:tracking-[0.22em]">
              {label}
            </p>
            <div className="mt-1 flex items-center gap-2 sm:mt-1.5 sm:gap-2.5">
              <p className="text-[21px] font-extrabold leading-none text-[#2b2b2b] sm:text-[30px]">{value}</p>
              <div className={`${backgroundClass} ${colorClass} flex h-8 w-8 shrink-0 items-center justify-center rounded-[13px] ring-1 ring-white/40 shadow-[inset_0_1px_0_rgba(255,255,255,0.45)] sm:h-10 sm:w-10 sm:rounded-[16px]`}>
                <Icon className="h-3.5 w-3.5 sm:h-4.5 sm:w-4.5" />
              </div>
            </div>
            {helperText ? (
              <p className="mt-1.5 truncate text-[10px] font-medium leading-[1.25] text-[#6b6b6b] sm:mt-2 sm:text-[11px]">
                {helperText}
              </p>
            ) : null}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
