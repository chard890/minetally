import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Sidebar from "@/components/Sidebar";
import { settingsService } from "@/services/settings.service";
import { FacebookPageRepository } from "@/repositories/facebook-page.repository";
import { isSupabaseConfigured } from "@/lib/supabase";
import { getActiveFacebookPageDbId, getKnownFacebookPageDbIds } from "@/lib/active-facebook-page";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "MineTally | Admin",
  description: "Automated claim counting for Facebook ukay ukay sellers",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const settings = isSupabaseConfigured()
    ? await settingsService.getSettings()
    : null;
  const activePageId = isSupabaseConfigured()
    ? await getActiveFacebookPageDbId()
    : null;
  const knownPageIds = isSupabaseConfigured()
    ? await getKnownFacebookPageDbIds()
    : [];
  const connectedPage = isSupabaseConfigured() && activePageId && knownPageIds.includes(activePageId)
    ? await FacebookPageRepository.getPageById(activePageId)
    : null;
  const isActivePageExpired = Boolean(
    connectedPage && (
      connectedPage.token_status === 'invalid' ||
      connectedPage.connection_status === 'needs_reconnect' ||
      connectedPage.reconnect_required
    ),
  );

  return (
    <html lang="en" className="h-full">
      <body className={`${inter.className} h-full`}>
        <div className="flex min-h-full min-w-0">
          <Sidebar 
            connectedPageId={connectedPage?.id}
            connectedPageName={connectedPage?.name} 
            isTokenExpired={isActivePageExpired || settings?.facebookIntegration.isTokenExpired} 
          />
          <main className="relative min-w-0 flex-1 overflow-y-auto pb-24 pt-[64px] pl-0 md:pl-2 lg:pb-0 lg:pt-0">
            <div className="relative z-10 mx-auto max-w-[1600px] px-3 py-3 sm:px-6 sm:py-5 lg:px-8 lg:py-7">
              <div className="soft-scrollbar min-h-[calc(100vh-2.75rem)] p-2.5 sm:p-6 lg:p-8">
              {children}
              </div>
            </div>
          </main>
        </div>
      </body>
    </html>
  );
}
