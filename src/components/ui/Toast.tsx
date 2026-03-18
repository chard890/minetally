'use client';

import { useEffect, useState } from 'react';
import { CheckCircle2, AlertCircle, X } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export type ToastType = 'success' | 'error' | 'info';

interface ToastProps {
  message: string;
  type?: ToastType;
  duration?: number;
  onClose: () => void;
}

export function Toast({ message, type = 'info', duration = 5000, onClose }: ToastProps) {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose();
    }, duration);

    return () => clearTimeout(timer);
  }, [duration, onClose]);

  const icons = {
    success: <CheckCircle2 className="h-5 w-5 text-emerald-500" />,
    error: <AlertCircle className="h-5 w-5 text-red-500" />,
    info: <CheckCircle2 className="h-5 w-5 text-blue-500" />,
  };

  const bgColors = {
    success: 'bg-emerald-50 border-emerald-100',
    error: 'bg-red-50 border-red-100',
    info: 'bg-blue-50 border-blue-100',
  };

  return (
    <div className={cn(
      "fixed bottom-8 right-8 z-50 flex items-center space-x-4 min-w-[320px] max-w-md p-4 rounded-2xl border shadow-2xl animate-in slide-in-from-right-8 duration-300",
      bgColors[type]
    )}>
      <div className="flex-shrink-0">
        {icons[type]}
      </div>
      <div className="flex-1 min-w-0">
        <p className={cn(
          "text-sm font-bold",
          type === 'success' ? "text-emerald-900" : type === 'error' ? "text-red-900" : "text-blue-900"
        )}>
          {type === 'success' ? 'Success' : type === 'error' ? 'Error' : 'Notification'}
        </p>
        <p className={cn(
          "text-xs font-medium mt-0.5 mt-1",
          type === 'success' ? "text-emerald-700" : type === 'error' ? "text-red-700" : "text-blue-700"
        )}>
          {message}
        </p>
      </div>
      <button 
        onClick={onClose}
        className="flex-shrink-0 rounded-lg p-1 hover:bg-white/50 transition-colors"
      >
        <X className="h-4 w-4 text-slate-400" />
      </button>
    </div>
  );
}
