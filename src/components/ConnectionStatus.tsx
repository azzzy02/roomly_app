import React from 'react';
import { AlertTriangle, CheckCircle2, Loader2, RefreshCw, WifiOff } from 'lucide-react';
import type { ConnectionState } from '@/src/types/chat';

interface ConnectionStatusProps {
  state: ConnectionState;
}

const CONFIG: Record<
  ConnectionState,
  {
    label: string;
    textClass: string;
    Icon: React.ComponentType<{ className?: string }>;
    spin?: boolean;
  }
> = {
  connected: {
    label: 'Connected',
    textClass: 'text-emerald-400',
    Icon: CheckCircle2,
  },
  connecting: {
    label: 'Connecting...',
    textClass: 'text-slate-400',
    Icon: Loader2,
    spin: true,
  },
  reconnecting: {
    label: 'Reconnecting...',
    textClass: 'text-amber-400',
    Icon: RefreshCw,
    spin: true,
  },
  offline: {
    label: 'Offline',
    textClass: 'text-amber-400',
    Icon: WifiOff,
  },
  error: {
    label: 'Connection Error',
    textClass: 'text-rose-400',
    Icon: AlertTriangle,
  },
};

export function ConnectionStatus({ state }: ConnectionStatusProps) {
  const { label, textClass, Icon, spin } = CONFIG[state];

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={`Connection status: ${label}`}
      className={`inline-flex items-center gap-1.5 text-xs font-medium whitespace-nowrap shrink-0 ${textClass}`}
    >
      <Icon className={`h-3.5 w-3.5 shrink-0 ${spin ? 'animate-spin' : ''}`} aria-hidden="true" />
      <span>{label}</span>
    </div>
  );
}
