import React, { useEffect, useState } from 'react';
import { getAvatarColor, getInitials } from '@/src/utils/formatting';

interface AvatarProps {
  uid: string;
  name: string;
  photoURL?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg';
}

const SIZE_CLASSES: Record<NonNullable<AvatarProps['size']>, string> = {
  xs: 'h-6 w-6 text-[10px]',
  sm: 'h-8 w-8 text-xs',
  md: 'h-9 w-9 text-xs',
  lg: 'h-12 w-12 text-sm',
};

export function Avatar({ uid, name, photoURL, size = 'md' }: AvatarProps) {
  const [imgError, setImgError] = useState(false);

  useEffect(() => {
    setImgError(false);
  }, [photoURL]);

  const sizeClass = SIZE_CLASSES[size];
  const colorClass = getAvatarColor(uid || name);
  const initials = getInitials(name);

  if (photoURL && !imgError) {
    return (
      <img
        src={photoURL}
        alt={`${name} avatar`}
        referrerPolicy="no-referrer"
        onError={() => setImgError(true)}
        className={`${sizeClass} shrink-0 rounded-full object-cover ring-1 ring-white/10`}
      />
    );
  }

  return (
    <div
      aria-label={`${name} avatar`}
      className={`${sizeClass} ${colorClass} flex shrink-0 items-center justify-center rounded-full font-display font-semibold select-none ring-1 ring-white/10`}
    >
      {initials}
    </div>
  );
}
