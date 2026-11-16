import React from 'react';

interface LogoProps {
  size?: 'sm' | 'md' | 'lg';
  showWordmark?: boolean;
}

export function Logo({ size = 'md', showWordmark = true }: LogoProps) {
  const boxSize =
    size === 'sm' ? 'h-7 w-7 rounded-lg' : size === 'lg' ? 'h-11 w-11 rounded-xl' : 'h-8 w-8 rounded-lg';
  const iconSize = size === 'sm' ? 16 : size === 'lg' ? 22 : 18;
  const textClass =
    size === 'sm' ? 'text-base' : size === 'lg' ? 'text-2xl' : 'text-lg';

  return (
    <div className="inline-flex items-center gap-2.5 select-none">
      <div
        className={`${boxSize} flex shrink-0 items-center justify-center bg-indigo-600 text-white shadow-sm shadow-indigo-950/60`}
        aria-hidden="true"
      >
        <svg
          width={iconSize}
          height={iconSize}
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M4 7.5C4 5.567 5.567 4 7.5 4H16.5C18.433 4 20 5.567 20 7.5V13.5C20 15.433 18.433 17 16.5 17H10.5L6 20.5V17H7.5C5.567 17 4 15.433 4 13.5V7.5Z"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <circle cx="9.25" cy="10.5" r="1.25" fill="currentColor" />
          <circle cx="14.75" cy="10.5" r="1.25" fill="currentColor" />
        </svg>
      </div>
      {showWordmark && (
        <span className={`font-display font-bold tracking-tight text-slate-100 whitespace-nowrap ${textClass}`}>
          Roomly
        </span>
      )}
    </div>
  );
}
