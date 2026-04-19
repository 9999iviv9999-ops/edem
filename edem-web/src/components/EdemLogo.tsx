import { useId } from "react";

type Props = {
  /** Pixel size (square). */
  size?: number;
  className?: string;
  /** Show title for screen readers (e.g. standalone on auth). */
  labeled?: boolean;
};

/**
 * Edem mark: garden arch + leaf + light — «вход в райский сад».
 */
export function EdemLogo({ size = 44, className = "", labeled = false }: Props) {
  const raw = useId().replace(/:/g, "");
  const gradStroke = `edem-stroke-${raw}`;
  const gradFill = `edem-fill-${raw}`;

  return (
    <svg
      className={`edem-logo ${className}`.trim()}
      width={size}
      height={size}
      viewBox="0 0 56 56"
      role={labeled ? "img" : "presentation"}
      aria-hidden={labeled ? undefined : true}
      aria-label={labeled ? "Edem" : undefined}
    >
      {labeled && <title>Edem</title>}
      <defs>
        <linearGradient id={gradStroke} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#f5efe4" />
          <stop offset="45%" stopColor="#8fbc9a" />
          <stop offset="100%" stopColor="#d4af37" />
        </linearGradient>
        <linearGradient id={gradFill} x1="0%" y1="100%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#1f4a32" />
          <stop offset="55%" stopColor="#5a8a6a" />
          <stop offset="100%" stopColor="#d4af37" />
        </linearGradient>
      </defs>
      <path
        d="M 6 48 Q 28 6 50 48"
        fill="none"
        stroke={`url(#${gradStroke})`}
        strokeWidth="3.25"
        strokeLinecap="round"
      />
      <path
        d="M 28 19 C 33 19 38 26 38 33 C 38 40 28 46 28 46 C 28 46 18 40 18 33 C 18 25 23 19 28 19 Z"
        fill={`url(#${gradFill})`}
        opacity={0.92}
      />
      <circle cx="28" cy="11" r="2.75" fill="#f5efe4" opacity={0.95} />
    </svg>
  );
}
