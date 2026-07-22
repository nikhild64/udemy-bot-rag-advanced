'use client';

import React from 'react';

export function DashboardSkeleton() {
  return (
    <div className="space-y-6 animate-pulse p-6">
      <div className="h-8 w-64 bg-slate-800 rounded-lg"></div>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-28 bg-slate-850 rounded-2xl border border-slate-800"></div>
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="h-64 bg-slate-850 rounded-2xl border border-slate-800"></div>
        <div className="h-64 bg-slate-850 rounded-2xl border border-slate-800"></div>
      </div>
    </div>
  );
}

export function NotebookSkeleton() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 animate-pulse">
      {[1, 2, 3, 4, 5, 6].map((i) => (
        <div key={i} className="h-44 bg-slate-850 rounded-2xl border border-slate-800 p-5 space-y-4">
          <div className="h-5 w-3/4 bg-slate-800 rounded"></div>
          <div className="h-4 w-full bg-slate-800/60 rounded"></div>
          <div className="h-4 w-1/2 bg-slate-800/40 rounded"></div>
        </div>
      ))}
    </div>
  );
}

export function SourceSkeleton() {
  return (
    <div className="space-y-3 animate-pulse">
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="h-16 bg-slate-850 rounded-xl border border-slate-800 p-3 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="h-8 w-8 bg-slate-800 rounded-lg"></div>
            <div className="space-y-2">
              <div className="h-4 w-36 bg-slate-800 rounded"></div>
              <div className="h-3 w-20 bg-slate-800/60 rounded"></div>
            </div>
          </div>
          <div className="h-6 w-16 bg-slate-800 rounded-full"></div>
        </div>
      ))}
    </div>
  );
}
