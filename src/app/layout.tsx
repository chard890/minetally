import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Sidebar from "@/components/Sidebar";
import { settingsService } from "@/services/settings.service";

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
  const settings = await settingsService.getSettings();
  const pageName = settings.facebookIntegration.connectedPageName;

  return (
    <html lang="en" className="h-full bg-slate-50">
      <body className={`${inter.className} h-full`}>
        <div className="flex h-full">
          <Sidebar 
            connectedPageName={pageName} 
            isTokenExpired={settings.facebookIntegration.isTokenExpired} 
          />
          <main className="flex-1 overflow-y-auto">
            <div className="mx-auto max-w-7xl px-8 py-10">
              {children}
            </div>
          </main>
        </div>
      </body>
    </html>
  );
}
