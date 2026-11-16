import React from 'react';

export function FullPageAuthSkeleton() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0B0E14] px-4">
      <div className="w-full max-w-md space-y-5 rounded-2xl border border-white/[0.07] bg-[#12161F] p-8">
        <div className="h-8 w-32 animate-pulse rounded-lg bg-white/10" />
        <div className="space-y-2.5">
          <div className="h-4 w-3/4 animate-pulse rounded bg-white/10" />
          <div className="h-4 w-1/2 animate-pulse rounded bg-white/5" />
        </div>
        <div className="h-11 w-full animate-pulse rounded-xl bg-white/10" />
      </div>
    </div>
  );
}

export function MessageListSkeleton() {
  return (
    <div className="space-y-5 px-4 py-6 sm:px-6" aria-label="Loading messages">
      {[
        { own: false, width: 'w-64' },
        { own: false, width: 'w-48' },
        { own: true, width: 'w-56' },
        { own: false, width: 'w-72' },
        { own: true, width: 'w-44' },
      ].map((row, idx) => (
        <div key={idx} className={`flex items-end gap-3 ${row.own ? 'justify-end' : 'justify-start'}`}>
          {!row.own && <div className="h-8 w-8 shrink-0 animate-pulse rounded-full bg-white/10" />}
          <div className={`space-y-2 ${row.own ? 'items-end' : 'items-start'} flex flex-col`}>
            <div className="h-3 w-24 animate-pulse rounded bg-white/10" />
            <div
              className={`h-11 ${row.width} animate-pulse rounded-2xl ${
                row.own ? 'bg-indigo-500/20' : 'bg-white/[0.07]'
              }`}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

export function RecentRoomsSkeleton() {
  return (
    <div className="space-y-2" aria-label="Loading recent rooms">
      {[1, 2, 3].map((item) => (
        <div
          key={item}
          className="flex h-11 items-center justify-between rounded-lg border border-white/[0.05] bg-white/[0.02] px-3"
        >
          <div className="h-3.5 w-32 animate-pulse rounded bg-white/10" />
          <div className="h-3 w-12 animate-pulse rounded bg-white/5" />
        </div>
      ))}
    </div>
  );
}
