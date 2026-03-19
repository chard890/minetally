'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  LayoutDashboard,
  Library,
  Users,
  Settings,
  LogOut,
  Package,
  Facebook,
  AlertCircle,
  ClipboardList,
  ShieldAlert,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { usePathname } from 'next/navigation';

const navItems = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Collections', href: '/collections', icon: Library },
  { name: 'Orders', href: '', icon: ClipboardList, disabled: true },
  { name: 'Buyer Totals', href: '/buyers', icon: Users },
  { name: 'Review Queue', href: '', icon: ShieldAlert, disabled: true },
  { name: 'Settings', href: '/settings', icon: Settings },
];

function NavIconButton({
  item,
  isActive,
}: {
  item: (typeof navItems)[number];
  isActive: boolean;
}) {
  const className = cn(
    'group/item flex h-11 items-center justify-center rounded-full px-0 transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover/nav:justify-start group-hover/nav:px-3',
    isActive
      ? 'bg-[rgba(255,142,110,0.2)] text-[#ff8e6e] shadow-[0_12px_24px_rgba(255,142,110,0.18)]'
      : item.disabled
        ? 'cursor-default text-[#b8afc8]'
        : 'text-[#877e98] hover:bg-white/35 hover:text-[#7a62b7] hover:translate-x-[2px]',
  );

  if (item.disabled) {
    return (
      <div className={className}>
        <span className="flex h-5 w-5 shrink-0 items-center justify-center">
          <item.icon className="h-[18px] w-[18px]" />
        </span>
        <span className="ml-0 max-w-0 overflow-hidden whitespace-nowrap text-[13px] font-semibold leading-none opacity-0 transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover/nav:max-w-[140px] group-hover/nav:ml-3 group-hover/nav:opacity-100">
          {item.name}
        </span>
      </div>
    );
  }

  return (
    <Link href={item.href} className={className}>
      <span className="flex h-5 w-5 shrink-0 items-center justify-center">
        <item.icon className="h-[18px] w-[18px]" />
      </span>
      <span className="ml-0 max-w-0 overflow-hidden whitespace-nowrap text-[13px] font-semibold leading-none opacity-0 transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover/nav:max-w-[140px] group-hover/nav:ml-3 group-hover/nav:opacity-100">
        {item.name}
      </span>
    </Link>
  );
}

export default function Sidebar({
  connectedPageId,
  connectedPageName = 'Connected Page',
  isTokenExpired = false,
}: {
  connectedPageId?: string;
  connectedPageName?: string;
  isTokenExpired?: boolean;
}) {
  const pathname = usePathname();
  const primaryNavItems = navItems.slice(0, 4);
  const secondaryNavItems = navItems.slice(4);
  const [pageImageError, setPageImageError] = useState(false);
  const connectedPageImageUrl = connectedPageId
    ? `https://graph.facebook.com/${connectedPageId}/picture?type=large`
    : null;
  const pageInitials = connectedPageName
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');

  return (
    <aside className="relative hidden h-screen w-[220px] shrink-0 overflow-visible p-4 pb-5 lg:block">
      <div className="flex h-full flex-col items-center overflow-visible py-2">
        <div className="flex items-center gap-2.5">
          <div className="flex h-14 w-14 items-center justify-center rounded-[22px] bg-[linear-gradient(145deg,#312741,#4b3a68)] text-white shadow-[0_14px_28px_rgba(47,39,64,0.22)]">
            <Package className="h-6 w-6" />
          </div>
          <div className="flex min-w-0 flex-col text-left">
            <p className="text-[10px] font-semibold leading-none tracking-[0.04em] text-[#4b4656]">
              MineTally
            </p>
            <p className="mt-1 text-[10px] font-bold leading-none text-[#2b2b2b]">
              Console
            </p>
          </div>
        </div>

        <div className="mt-5 w-full px-1">
          <div className="overflow-hidden rounded-[26px] border border-white/55 bg-[rgba(255,255,255,0.5)] p-3 backdrop-blur-[14px] shadow-[0_14px_30px_rgba(110,91,140,0.14),inset_0_1px_0_rgba(255,255,255,0.4)]">
            <div className="relative h-[132px] overflow-hidden rounded-[20px] bg-[linear-gradient(135deg,rgba(255,142,110,0.16),rgba(183,156,245,0.22))]">
              {connectedPageImageUrl && !pageImageError ? (
                <img
                  src={connectedPageImageUrl}
                  alt={connectedPageName}
                  className="h-full w-full object-cover"
                  onError={() => setPageImageError(true)}
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-[linear-gradient(145deg,#f4d7ce,#ecdff5)] text-xl font-black text-[#6a5d80]">
                  {pageInitials || 'FB'}
                </div>
              )}
              <div className="absolute inset-x-0 bottom-0 h-20 bg-[linear-gradient(180deg,transparent,rgba(255,247,241,0.9))]" />
              <div className="absolute inset-x-3 bottom-3 rounded-[18px] border border-white/60 bg-[rgba(255,255,255,0.62)] px-3 py-2 backdrop-blur-[14px] shadow-[0_10px_24px_rgba(110,91,140,0.12)]">
                <div className="flex items-center gap-2">
                  <div
                    className={cn(
                      'h-2.5 w-2.5 shrink-0 rounded-full',
                      isTokenExpired ? 'bg-[#ffb35c] animate-pulse' : 'bg-[#8ecfb5]',
                    )}
                  />
                  <p className="truncate text-[12px] font-bold leading-none text-[#2b2b2b]">
                    {connectedPageName}
                  </p>
                  {isTokenExpired ? (
                    <AlertCircle className="ml-auto h-3.5 w-3.5 shrink-0 text-[#d48f30]" />
                  ) : (
                    <Facebook className="ml-auto h-3.5 w-3.5 shrink-0 text-[#7a62b7]" />
                  )}
                </div>
                <p className="mt-1 text-[10px] font-medium leading-none text-[#6b6b6b]">
                  {isTokenExpired ? 'Reconnect required' : 'Connected Facebook page'}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-7 flex flex-1 flex-col items-center justify-between overflow-visible">
          <div className="w-full space-y-4 overflow-visible">
            <div className="group/nav w-[60px] overflow-hidden rounded-[28px] border border-white/55 bg-[rgba(255,255,255,0.52)] px-3 py-3 backdrop-blur-[14px] shadow-[0_16px_32px_rgba(110,91,140,0.14),inset_0_1px_0_rgba(255,255,255,0.4)] transition-[width] duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] hover:w-[196px]">
              <nav className="space-y-2">
                {primaryNavItems.map((item) => (
                  <NavIconButton
                    key={item.name}
                    item={item}
                    isActive={item.href ? pathname.startsWith(item.href) : false}
                  />
                ))}
              </nav>
            </div>

            <div className="group/nav w-[60px] overflow-hidden rounded-[28px] border border-white/55 bg-[rgba(255,255,255,0.52)] px-3 py-3 backdrop-blur-[14px] shadow-[0_16px_32px_rgba(110,91,140,0.14),inset_0_1px_0_rgba(255,255,255,0.4)] transition-[width] duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] hover:w-[196px]">
              <nav className="space-y-2">
                {secondaryNavItems.map((item) => (
                  <NavIconButton
                    key={item.name}
                    item={item}
                    isActive={item.href ? pathname.startsWith(item.href) : false}
                  />
                ))}
              </nav>
            </div>
          </div>

          <div className="mt-4 flex w-full justify-center">
            <button
              className="group relative flex h-12 w-[60px] items-center justify-center rounded-[22px] border border-white/50 bg-[rgba(255,255,255,0.42)] text-[#6d6a77] shadow-[0_12px_24px_rgba(110,91,140,0.12)] backdrop-blur-[10px] hover:bg-[rgba(255,255,255,0.58)] hover:text-[#ef7e7e]"
            >
              <LogOut className="h-[18px] w-[18px]" />
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
}
