import React from 'react';

interface LogoProps {
  /** Rendered size in px (square). */
  size?: number;
  className?: string;
}

/**
 * SooVoice brand mark: rounded square with a voice waveform.
 * Mirrors /public/favicon.svg — keep both in sync when changing the design.
 */
export function Logo({ size = 32, className = '' }: LogoProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      className={className}
      role="img"
      aria-label="SooVoice"
    >
      <defs>
        <linearGradient id="soovoice-grad" x1="0" y1="0" x2="64" y2="64" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#4F46E5" />
          <stop offset="1" stopColor="#7C3AED" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="18" fill="url(#soovoice-grad)" />
      <g fill="#FFFFFF">
        <rect x="12" y="26" width="5" height="12" rx="2.5" />
        <rect x="21" y="20" width="5" height="24" rx="2.5" />
        <rect x="30" y="14" width="5" height="36" rx="2.5" />
        <rect x="39" y="20" width="5" height="24" rx="2.5" />
        <rect x="48" y="26" width="5" height="12" rx="2.5" />
      </g>
    </svg>
  );
}
