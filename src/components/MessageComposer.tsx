import React, { useEffect, useRef, useState } from 'react';
import { SendHorizontal } from 'lucide-react';
import { MESSAGE_MAX_LENGTH, validateMessageText } from '@/src/utils/validation';

interface MessageComposerProps {
  roomName: string;
  disabled?: boolean;
  isCooldownActive?: boolean;
  onSendMessage: (text: string) => Promise<boolean>;
}

export function MessageComposer({
  roomName,
  disabled = false,
  isCooldownActive = false,
  onSendMessage,
}: MessageComposerProps) {
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const isComposingRef = useRef(false);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [text]);

  const charCount = text.trim().length;
  const isOverLimit = charCount > MESSAGE_MAX_LENGTH;

  const triggerSend = async () => {
    if (disabled || submitting || isCooldownActive) return;

    const validation = validateMessageText(text);
    if (!validation.valid) {
      setError(validation.error || 'You cannot send an empty message.');
      return;
    }

    setError(null);
    setSubmitting(true);
    try {
      const sent = await onSendMessage(text);
      if (sent) {
        setText('');
        if (textareaRef.current) {
          textareaRef.current.style.height = 'auto';
          textareaRef.current.focus();
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to send message.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      // Do not submit during IME composition
      if (isComposingRef.current || e.nativeEvent.isComposing) {
        return;
      }
      e.preventDefault();
      void triggerSend();
    }
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void triggerSend();
  };

  return (
    <div className="shrink-0 border-t border-white/[0.07] bg-[#0B0E14] px-3 py-3 sm:px-6 sm:py-4">
      <form onSubmit={handleFormSubmit} className="mx-auto max-w-4xl">
        <div
          className={`flex items-end gap-2 rounded-2xl border bg-[#12161F] p-2 transition-colors ${
            error || isOverLimit
              ? 'border-rose-500/60'
              : 'border-white/10 focus-within:border-indigo-500/60'
          }`}
        >
          <label htmlFor="message-composer-input" className="sr-only">
            Message #{roomName}
          </label>
          <textarea
            ref={textareaRef}
            id="message-composer-input"
            rows={1}
            value={text}
            disabled={disabled}
            onChange={(e) => {
              setText(e.target.value);
              if (error) setError(null);
            }}
            onKeyDown={handleKeyDown}
            onCompositionStart={() => {
              isComposingRef.current = true;
            }}
            onCompositionEnd={() => {
              isComposingRef.current = false;
            }}
            placeholder={`Message #${roomName}`}
            aria-invalid={Boolean(error || isOverLimit)}
            className="max-h-40 min-h-[40px] flex-1 resize-none bg-transparent px-2.5 py-2 text-[15px] leading-relaxed text-slate-100 placeholder:text-slate-500 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
          />

          <button
            type="submit"
            disabled={disabled || submitting || isCooldownActive || isOverLimit}
            aria-label="Send message"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-indigo-600 text-white transition-colors hover:bg-indigo-500 disabled:cursor-not-allowed disabled:bg-white/10 disabled:text-slate-500 focus-visible:outline-2 focus-visible:outline-indigo-400"
          >
            <SendHorizontal className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <div className="mt-1.5 flex items-center justify-between gap-4 px-1">
          <div className="min-w-0">
            {error ? (
              <p role="alert" className="text-xs font-medium text-rose-400">
                {error}
              </p>
            ) : isOverLimit ? (
              <p role="alert" className="text-xs font-medium text-rose-400">
                Your message exceeds the {MESSAGE_MAX_LENGTH}-character limit.
              </p>
            ) : (
              <p className="hidden text-[11px] text-slate-500 sm:block">
                Enter to send · Shift+Enter for new line
              </p>
            )}
          </div>

          {charCount > 1500 && (
            <span
              className={`font-mono-tabular shrink-0 text-[11px] ${
                isOverLimit ? 'font-semibold text-rose-400' : 'text-slate-400'
              }`}
            >
              {charCount}/{MESSAGE_MAX_LENGTH}
            </span>
          )}
        </div>
      </form>
    </div>
  );
}
