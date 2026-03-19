import * as React from "react"
import { cn } from "@/lib/utils"

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg' | 'icon';
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', ...props }, ref) => {
    const variants = {
      primary: 'border border-[#ff9f84]/60 bg-[#ff8e6e] text-white shadow-[0_12px_24px_rgba(255,142,110,0.28)] hover:-translate-y-0.5 hover:bg-[#f77656]',
      secondary: 'border border-white/55 bg-white/70 text-[#2b2b2b] shadow-[0_8px_18px_rgba(110,91,140,0.1)] hover:-translate-y-0.5 hover:bg-white/85',
      outline: 'border border-white/60 bg-white/42 text-[#4f4a57] shadow-[0_8px_18px_rgba(110,91,140,0.08)] hover:-translate-y-0.5 hover:bg-white/70',
      ghost: 'text-[#6b6b6b] hover:-translate-y-0.5 hover:bg-white/50',
      danger: 'border border-[#f4a2a2]/60 bg-[#ef7e7e] text-white shadow-[0_12px_24px_rgba(239,126,126,0.22)] hover:-translate-y-0.5 hover:bg-[#e56868]',
    };

    const sizes = {
      sm: 'h-9 px-3.5 text-xs',
      md: 'h-11 px-5 py-2 text-sm',
      lg: 'h-12 px-8 text-base',
      icon: 'h-11 w-11',
    };

    return (
      <button
        ref={ref}
        className={cn(
          "inline-flex items-center justify-center rounded-[18px] font-semibold transition-all duration-200 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#ff8e6e]/20 disabled:pointer-events-none disabled:opacity-50",
          variants[variant],
          sizes[size],
          className
        )}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button }
