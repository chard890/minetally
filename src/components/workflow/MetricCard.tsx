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
      <CardContent className="!p-3.5">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[#8b8594]">
              {label}
            </p>
            <div className="mt-1.5 flex items-center gap-2.5">
              <p className="text-[30px] font-extrabold leading-none text-[#2b2b2b]">{value}</p>
              <div className={`${backgroundClass} ${colorClass} flex h-10 w-10 shrink-0 items-center justify-center rounded-[16px] ring-1 ring-white/40 shadow-[inset_0_1px_0_rgba(255,255,255,0.45)]`}>
                <Icon className="h-4.5 w-4.5" />
              </div>
            </div>
            {helperText ? (
              <p className="mt-2 truncate text-[11px] font-medium leading-[1.25] text-[#6b6b6b]">
                {helperText}
              </p>
            ) : null}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
