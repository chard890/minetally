'use client';

import { Info, HelpCircle, CheckCircle2, AlertTriangle, Scale } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';

interface ResolutionTransparencyProps {
  sourceText: string;
  ruleUsed: string;
  resultValue: string | number | null;
  status: 'auto' | 'manual' | 'needs_review';
  type: 'winner' | 'price';
}

export function ResolutionTransparency({
  sourceText,
  ruleUsed,
  resultValue,
  status,
  type
}: ResolutionTransparencyProps) {
  const isWinner = type === 'winner';
  
  return (
    <Card className="border-0 shadow-sm ring-1 ring-slate-100 bg-slate-50/20 overflow-hidden">
      <CardHeader className="py-3 px-4 bg-slate-100/50 border-b border-slate-100">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Scale className="h-4 w-4 text-slate-500" />
            <p className="text-xs font-black uppercase tracking-widest text-slate-600">
              {isWinner ? 'Winner Resolution' : 'Price Resolution'} Logic
            </p>
          </div>
          <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase border ${
            status === 'auto' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' :
            status === 'manual' ? 'bg-blue-50 text-blue-700 border-blue-100' :
            'bg-amber-50 text-amber-700 border-amber-100'
          }`}>
            {status === 'auto' ? 'System Resolved' : status === 'manual' ? 'Manual Override' : 'Review Required'}
          </span>
        </div>
      </CardHeader>
      <CardContent className="p-4">
        <div className="flex items-center justify-between text-[11px] font-medium text-slate-500 mb-2">
          <span>Source</span>
          <span>Rule</span>
          <span className="text-right">Result</span>
        </div>
        <div className="flex items-center space-x-2">
          <div className="flex-1 p-2 rounded-xl bg-white border border-slate-100 min-h-[40px] flex items-center">
             <span className="text-xs font-bold text-slate-900 truncate max-w-[120px]" title={sourceText}>
               {sourceText || (isWinner ? 'Comments' : 'Caption')}
             </span>
          </div>
          <div className="p-1 text-slate-300">+</div>
          <div className="flex-1 p-2 rounded-xl bg-white border border-slate-100 min-h-[40px] flex items-center justify-center">
             <span className="text-[10px] font-black text-slate-600 text-center uppercase leading-tight">
               {ruleUsed}
             </span>
          </div>
          <div className="p-1 text-slate-300">=</div>
          <div className={`flex-1 p-2 rounded-xl border min-h-[40px] flex items-center justify-center shadow-sm ${
            resultValue ? 'bg-indigo-600 text-white border-indigo-500' : 'bg-white text-slate-400 border-slate-100 dashed'
          }`}>
             <span className="text-sm font-black tracking-tight uppercase">
               {resultValue || 'None'}
             </span>
          </div>
        </div>
        
        <div className="mt-3 flex items-start space-x-2">
          <Info className="h-3 w-3 text-slate-400 mt-0.5" />
          <p className="text-[10px] text-slate-500 leading-relaxed italic">
            {isWinner 
              ? "System scanned all comments sorted by time and applied 'First Valid Claim' rule based on your claim keywords."
              : "System parsed the item description or batch caption for code-price pairs (e.g. 'M 150') and matched the winner's claim word."}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
