import React from 'react';
import { AlertCircle, Clock, RotateCcw, X } from 'lucide-react';
import { Avatar } from '@/src/components/Avatar';
import type { ChatMessage } from '@/src/types/chat';
import { formatMessageTime } from '@/src/utils/formatting';

interface MessageItemProps {
  message: ChatMessage;
  isOwn: boolean;
  showSenderHeader: boolean;
  onRetry: (message: ChatMessage) => void;
  onDismissFailed: (messageId: string) => void;
}

export function MessageItem({
  message,
  isOwn,
  showSenderHeader,
  onRetry,
  onDismissFailed,
}: MessageItemProps) {
  const createdDate =
    message.createdAt && typeof message.createdAt.toDate === 'function'
      ? message.createdAt.toDate()
      : null;

  const isFailed = message.deliveryStatus === 'failed';
  const isSending = !isFailed && (message.hasPendingWrites || !createdDate);

  return (
    <div
      className={`flex items-end gap-2.5 ${isOwn ? 'justify-end' : 'justify-start'} ${
        showSenderHeader ? 'mt-4' : 'mt-1'
      }`}
    >
      {!isOwn && (
        <div className="w-8 shrink-0">
          {showSenderHeader ? (
            <Avatar
              uid={message.senderId}
              name={message.senderName}
              photoURL={message.senderPhotoURL}
              size="sm"
            />
          ) : (
            <div className="w-8" aria-hidden="true" />
          )}
        </div>
      )}

      <div className={`flex max-w-[82%] flex-col sm:max-w-[70%] ${isOwn ? 'items-end' : 'items-start'}`}>
        {showSenderHeader && (
          <div className={`mb-1 flex items-center gap-1.5 px-1 ${isOwn ? 'flex-row-reverse' : ''}`}>
            <span className="text-xs font-semibold text-slate-300">
              {isOwn ? 'You' : message.senderName}
            </span>
            {message.senderUsername && (
              <span className="text-[11px] text-slate-500">@{message.senderUsername}</span>
            )}
          </div>
        )}

        <div
          className={`rounded-2xl px-4 py-2.5 text-[15px] leading-relaxed transition-colors ${
            isOwn
              ? isFailed
                ? 'border border-rose-500/40 bg-rose-950/50 text-rose-100'
                : 'border border-indigo-400/20 bg-indigo-600 text-white'
              : 'border border-white/[0.07] bg-[#161B26] text-slate-100'
          } ${
            showSenderHeader
              ? isOwn
                ? 'rounded-tr-sm'
                : 'rounded-tl-sm'
              : ''
          }`}
        >
          <p className="whitespace-pre-wrap break-words">{message.text}</p>

          <div
            className={`mt-1 flex items-center gap-1.5 font-mono-tabular text-[11px] ${
              isOwn
                ? isFailed
                  ? 'justify-end text-rose-300'
                  : 'justify-end text-indigo-200/80'
                : 'justify-start text-slate-500'
            }`}
          >
            {isSending ? (
              <>
                <Clock className="h-3 w-3 shrink-0" aria-hidden="true" />
                <span>Sending...</span>
              </>
            ) : isFailed ? (
              <>
                <AlertCircle className="h-3 w-3 shrink-0 text-rose-400" aria-hidden="true" />
                <span>Not sent</span>
              </>
            ) : (
              <span>{formatMessageTime(createdDate)}</span>
            )}
          </div>
        </div>

        {isFailed && (
          <div className="mt-1.5 flex flex-wrap items-center justify-end gap-2 px-1">
            {message.deliveryError && (
              <span className="text-xs text-rose-400">{message.deliveryError}</span>
            )}
            <button
              type="button"
              onClick={() => onRetry(message)}
              className="inline-flex h-7 items-center gap-1 rounded-lg border border-rose-500/30 bg-rose-500/10 px-2.5 text-xs font-medium text-rose-300 transition-colors hover:bg-rose-500/20 focus-visible:outline-2 focus-visible:outline-rose-400"
            >
              <RotateCcw className="h-3 w-3" aria-hidden="true" />
              <span>Retry</span>
            </button>
            <button
              type="button"
              onClick={() => onDismissFailed(message.messageId)}
              aria-label="Dismiss failed message"
              className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-white/5 hover:text-slate-200 focus-visible:outline-2 focus-visible:outline-indigo-500"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
