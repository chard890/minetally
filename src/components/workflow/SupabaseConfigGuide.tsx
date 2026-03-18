"use client";

import { AlertTriangle, Database, Terminal, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";

export function SupabaseConfigGuide() {
  return (
    <div className="flex min-h-[80vh] items-center justify-center p-6">
      <Card className="max-w-2xl border-0 shadow-2xl ring-1 ring-slate-200 overflow-hidden rounded-3xl">
        <CardHeader className="bg-slate-900 text-white p-8">
          <div className="flex items-center space-x-4 mb-4">
            <div className="p-3 bg-indigo-500 rounded-2xl">
              <Database className="h-6 w-6 text-white" />
            </div>
            <div>
              <CardTitle className="text-2xl font-black">Supabase Configuration Required</CardTitle>
              <p className="text-slate-400 text-sm font-medium">MineTally needs a persistent database to function.</p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-8 space-y-8">
          <div className="space-y-4">
            <h3 className="font-bold text-slate-900 flex items-center">
              <Terminal className="h-4 w-4 mr-2 text-indigo-600" />
              1. Setup Local Environment
            </h3>
            <p className="text-sm text-slate-600">
              Open your <code className="px-1.5 py-0.5 bg-slate-100 rounded text-indigo-600 font-mono">.env.local</code> file and populate it with your Supabase project credentials.
            </p>
            <div className="bg-slate-900 rounded-2xl p-6 font-mono text-[11px] text-indigo-300 space-y-2 shadow-inner">
              <p>NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co</p>
              <p>NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key</p>
              <p>SUPABASE_SERVICE_ROLE_KEY=your-service-role-key</p>
            </div>
          </div>

          <div className="space-y-4 pt-4 border-t border-slate-100">
            <h3 className="font-bold text-slate-900 flex items-center">
              <AlertTriangle className="h-4 w-4 mr-2 text-amber-500" />
              2. Run Database Migrations
            </h3>
            <p className="text-sm text-slate-600">
              Ensure your database schema is up to date. If you&apos;re using Supabase CLI, run:
            </p>
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 font-mono text-xs text-slate-700">
              npx supabase db push
            </div>
          </div>

          <div className="space-y-4 pt-4 border-t border-slate-100">
             <h3 className="font-bold text-slate-900 flex items-center">
              <CheckCircle2 className="h-4 w-4 mr-2 text-emerald-500" />
              3. Seed Mock Data (Optional)
            </h3>
            <p className="text-sm text-slate-600">
              If you want to start with the demo data, run the seeding script:
            </p>
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 font-mono text-xs text-slate-700">
              npx ts-node supabase-seed.ts
            </div>
          </div>

          <div className="pt-6">
            <Button 
              className="w-full h-12 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-2xl shadow-lg shadow-indigo-100"
              onClick={() => window.location.reload()}
            >
              Check Connection Again
            </Button>
            <p className="text-center text-[11px] text-slate-400 mt-4 leading-relaxed italic">
              After setting the environment variables, restart your terminal and run <code className="font-bold">npm run dev</code> again to apply the changes.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
