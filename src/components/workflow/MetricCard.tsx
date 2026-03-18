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
    <Card className="border-0 shadow-sm ring-1 ring-slate-100">
      <CardContent className="pt-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
              {label}
            </p>
            <p className="mt-1 text-3xl font-black text-slate-900">{value}</p>
            {helperText ? (
              <p className="mt-1 text-xs font-medium text-slate-400">{helperText}</p>
            ) : null}
          </div>
          <div className={`${backgroundClass} ${colorClass} rounded-2xl p-3 ring-1 ring-black/5`}>
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
