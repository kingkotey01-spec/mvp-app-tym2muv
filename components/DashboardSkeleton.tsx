import React from 'react';

export const WidgetSkeleton: React.FC = () => (
  <div className="animate-pulse bg-white p-5 rounded-2xl border border-slate-100 shadow-sm space-y-4">
    <div className="flex justify-between items-start">
      <div className="w-12 h-12 bg-slate-200 rounded-xl"></div>
      <div className="w-14 h-4 bg-slate-200 rounded-md"></div>
    </div>
    <div className="h-4 bg-slate-200 rounded w-1/3"></div>
    <div className="h-7 bg-slate-200 rounded-md w-1/2"></div>
  </div>
);

export const TableSkeleton: React.FC<{ rows?: number }> = ({ rows = 5 }) => (
  <div className="animate-pulse bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden p-6 space-y-4">
    <div className="flex justify-between items-center pb-2 border-b border-slate-150">
      <div className="h-5 bg-slate-200 rounded w-1/4"></div>
      <div className="h-8 bg-slate-200 rounded-lg w-32"></div>
    </div>
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex item-center justify-between py-3 border-b border-slate-50 last:border-0">
          <div className="flex items-center gap-3 flex-1">
            <div className="w-10 h-10 bg-slate-200 rounded-lg shrink-0"></div>
            <div className="space-y-2 flex-1">
              <div className="h-4 bg-slate-200 rounded w-2/5"></div>
              <div className="h-3 bg-slate-200 rounded w-1/5"></div>
            </div>
          </div>
          <div className="w-24 h-5 bg-slate-200 rounded shrink-0 self-center"></div>
        </div>
      ))}
    </div>
  </div>
);

export const ChartSkeleton: React.FC = () => (
  <div className="animate-pulse bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-4">
    <div className="h-5 bg-slate-200 rounded w-1/3"></div>
    <div className="h-64 bg-slate-200 rounded-xl w-full flex items-end p-4 gap-3">
      <div className="h-1/3 bg-slate-305/40 rounded-t w-full"></div>
      <div className="h-2/3 bg-slate-305/40 rounded-t w-full"></div>
      <div className="h-1/2 bg-slate-305/40 rounded-t w-full"></div>
      <div className="h-3/4 bg-slate-305/40 rounded-t w-full"></div>
      <div className="h-2/5 bg-slate-305/40 rounded-t w-full"></div>
      <div className="h-5/6 bg-slate-305/40 rounded-t w-full"></div>
    </div>
  </div>
);

export const AdminDashboardSkeleton: React.FC = () => (
  <div className="min-h-screen bg-slate-50/50 flex flex-col md:flex-row">
    {/* Left Column Mock Sidebar */}
    <div className="w-full md:w-64 bg-white border-r border-slate-200/80 flex flex-col p-6 space-y-6 shrink-0 h-auto md:h-screen sticky top-0">
      <div className="flex items-center gap-3 border-b border-slate-100 pb-5">
        <div className="w-8 h-8 bg-slate-200 rounded-lg animate-pulse" />
        <div className="h-5 bg-slate-200 rounded w-2/3 animate-pulse" />
      </div>
      <div className="space-y-3 flex-1">
        {Array.from({ length: 6 }).map((_, idx) => (
          <div key={idx} className="flex items-center gap-3 py-3 px-2 rounded-xl border border-transparent">
            <div className="w-5 h-5 bg-slate-200 rounded-md animate-pulse shrink-0" />
            <div className="h-3.5 bg-slate-200 rounded w-1/2 animate-pulse" />
          </div>
        ))}
      </div>
    </div>

    {/* Right Column Body */}
    <div className="flex-1 p-6 md:p-8 space-y-8 overflow-y-auto">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-100 pb-6">
        <div className="space-y-1.5 w-full sm:w-auto">
          <div className="h-6 bg-slate-200 rounded w-48 animate-pulse" />
          <div className="h-4 bg-slate-200 rounded w-64 animate-pulse" />
        </div>
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className="w-24 h-9 bg-slate-200 rounded-xl animate-pulse" />
          <div className="w-24 h-9 bg-slate-200 rounded-xl animate-pulse" />
          <div className="w-32 h-9 bg-slate-200 rounded-xl animate-pulse flex-1 sm:flex-initial" />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <WidgetSkeleton />
        <WidgetSkeleton />
        <WidgetSkeleton />
        <WidgetSkeleton />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <ChartSkeleton />
        </div>
        <div>
          <TableSkeleton rows={4} />
        </div>
      </div>
    </div>
  </div>
);

export const AgentDashboardSkeleton: React.FC = () => (
  <div className="max-w-7xl mx-auto px-4 py-8 space-y-8 animate-pulse">
    {/* Page Header */}
    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 pb-6 border-b border-slate-100">
      <div className="space-y-2">
        <div className="h-7 bg-slate-200 rounded w-56"></div>
        <div className="h-4 bg-slate-200 rounded w-80"></div>
      </div>
      <div className="flex gap-3">
        <div className="w-28 h-10 bg-slate-200 rounded-xl"></div>
        <div className="w-32 h-10 bg-slate-200 rounded-xl"></div>
      </div>
    </div>

    {/* Metrics Dashboard Layout */}
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
      <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-3xs space-y-3">
        <div className="w-10 h-10 bg-slate-200 rounded-lg" />
        <div className="h-4 bg-slate-200 rounded w-1/2" />
        <div className="h-6 bg-slate-200 rounded w-1/3" />
      </div>
      <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-3xs space-y-3">
        <div className="w-10 h-10 bg-slate-200 rounded-lg" />
        <div className="h-4 bg-slate-200 rounded w-1/2" />
        <div className="h-6 bg-slate-200 rounded w-1/3" />
      </div>
      <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-3xs space-y-3">
        <div className="w-10 h-10 bg-slate-200 rounded-lg" />
        <div className="h-4 bg-slate-200 rounded w-1/2" />
        <div className="h-6 bg-slate-200 rounded w-1/3" />
      </div>
      <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-3xs space-y-3">
        <div className="w-10 h-10 bg-slate-200 rounded-lg" />
        <div className="h-4 bg-slate-200 rounded w-1/2" />
        <div className="h-6 bg-slate-200 rounded w-1/3" />
      </div>
    </div>

    {/* Grid Content Panels */}
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2 space-y-4">
        <div className="flex justify-between items-center">
          <div className="h-5 bg-slate-200 rounded w-36"></div>
          <div className="h-4 bg-slate-200 rounded w-16"></div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="h-48 bg-slate-200 rounded-2xl"></div>
          <div className="h-48 bg-slate-200 rounded-2xl"></div>
        </div>
      </div>
      <div className="space-y-4">
        <div className="h-5 bg-slate-200 rounded w-32"></div>
        <div className="h-64 bg-slate-200 rounded-2xl"></div>
      </div>
    </div>
  </div>
);
