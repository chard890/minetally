'use client';

import Link from 'next/link';
import { 
  LayoutDashboard, 
  Library, 
  Users, 
  Settings, 
  LogOut,
  Package,
  Facebook,
  AlertCircle
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { usePathname } from 'next/navigation';

const navItems = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Collections', href: '/collections', icon: Library },
  { name: 'Buyer Totals', href: '/buyers', icon: Users },
  { name: 'Settings', href: '/settings', icon: Settings },
];

export default function Sidebar({ 
  connectedPageName = "Connected Page",
  isTokenExpired = false 
}: { 
  connectedPageName?: string,
  isTokenExpired?: boolean 
}) {
  const pathname = usePathname();

  return (
    <div className="flex h-full w-64 flex-col border-r border-slate-200 bg-white">
      <div className="flex h-16 items-center border-b border-slate-200 px-6">
        <Package className="h-6 w-6 text-indigo-600" />
        <span className="ml-2 text-xl font-bold text-slate-900 tracking-tight">MineTally</span>
      </div>

      {/* Connected Page Info */}
      <div className={cn(
        "mt-4 mx-4 p-3 rounded-xl border flex flex-col gap-1",
        isTokenExpired 
          ? "bg-amber-50 border-amber-200 text-amber-900" 
          : "bg-indigo-50 border-indigo-100 text-indigo-900"
      )}>
        <div className="flex items-center justify-between">
          <span className="text-[10px] uppercase font-bold tracking-wider opacity-60">Connected Page</span>
          <div className={cn(
            "w-2 h-2 rounded-full",
            isTokenExpired ? "bg-amber-400 animate-pulse" : "bg-emerald-400"
          )} />
        </div>
        <div className="flex items-center gap-1.5 min-w-0">
          <p className="font-semibold truncate text-xs flex-1">
            {connectedPageName}
          </p>
          {isTokenExpired && <AlertCircle className="h-3.5 w-3.5 text-amber-600 flex-shrink-0" />}
        </div>
        {isTokenExpired && (
          <p className="text-[10px] text-amber-700 mt-1 leading-tight font-medium">
            Session expired. Please reconnect in settings.
          </p>
        )}
      </div>
      
      <nav className="flex-1 space-y-1.5 px-4 py-6">
        {navItems.map((item) => {
          const isActive = pathname.startsWith(item.href);
          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                "group flex items-center rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200",
                isActive 
                  ? "bg-indigo-50 text-indigo-600 shadow-sm" 
                  : "text-slate-600 hover:bg-slate-50 hover:text-indigo-600"
              )}
            >
              <item.icon className={cn(
                "mr-3 h-5 w-5 flex-shrink-0",
                isActive ? "text-indigo-600" : "text-slate-400 group-hover:text-indigo-600"
              )} />
              {item.name}
            </Link>
          );
        })}
      </nav>

      <div className="p-4 bg-slate-50/50 m-4 rounded-xl border border-slate-100">
        <div className="flex items-center space-x-3 mb-3">
          <div className="bg-blue-600 p-1.5 rounded-lg">
            <Facebook className="h-4 w-4 text-white" />
          </div>
          <div className="overflow-hidden">
            <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Connected Page</p>
            <p className="text-sm font-bold text-slate-900 truncate">{connectedPageName}</p>
          </div>
        </div>
      </div>

      <div className="border-t border-slate-200 p-4">
        <button className="flex w-full items-center rounded-lg px-3 py-2 text-sm font-bold text-slate-500 hover:bg-red-50 hover:text-red-500 transition-colors">
          <LogOut className="mr-3 h-5 w-5" />
          Logout
        </button>
      </div>
    </div>
  );
}
