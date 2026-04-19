import { useId } from "react";

type Props = {
  size?: number;
  className?: string;
  /** Доступность: осмысленный alt / role */
  labeled?: boolean;
  /** Рядом с знаком текст «Vprok» — для варианта `svg`; у `luxury` подпись уже в PNG */
  wordmark?: boolean;
  /** `luxury` — PNG из `/public`; `svg` — прежний векторный знак */
  variant?: "luxury" | "svg";
};

export function VprokLogo({
  size = 44,
  className = "",
  labeled = false,
  wordmark = false,
  variant = "luxury"
}: Props) {
  if (variant === "luxury") {
    const h = wordmark ? Math.round(size * 1.38) : size;
    return (
      <img
        src="/vprok-logo-luxury.png"
        alt="Vprok"
        className={`vprok-logo vprok-logo--luxury ${className}`.trim()}
        style={{
          height: h,
          width: "auto",
          maxHeight: h,
          objectFit: "contain",
          display: "block"
        }}
        width={wordmark ? Math.round(size * 4.2) : size}
        height={h}
        loading="lazy"
        decoding="async"
        {...(labeled || wordmark ? {} : { "aria-hidden": true as const })}
      />
    );
  }

  const raw = useId().replace(/:/g, "");
  const gBg = `vprok-bg-${raw}`;
  const gRing = `vprok-ring-${raw}`;
  const gMark = `vprok-mark-${raw}`;

  const svg = (
    <svg
      className={`vprok-logo ${className}`.trim()}
      width={size}
      height={size}
      viewBox="0 0 56 56"
      role={labeled || wordmark ? "img" : "presentation"}
      aria-hidden={labeled || wordmark ? undefined : true}
      aria-label={labeled || wordmark ? "Vprok" : undefined}
    >
      {(labeled || wordmark) && <title>Vprok</title>}
      <defs>
        <linearGradient id={gBg} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#121a33" />
          <stop offset="100%" stopColor="#1b2450" />
        </linearGradient>
        <linearGradient id={gRing} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#7dc4ff" />
          <stop offset="50%" stopColor="#4f74ff" />
          <stop offset="100%" stopColor="#c084fc" />
        </linearGradient>
        <linearGradient id={gMark} x1="0%" y1="100%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#e8eeff" />
          <stop offset="55%" stopColor="#c6d5ff" />
          <stop offset="100%" stopColor="#7dc4ff" />
        </linearGradient>
      </defs>
      <rect x="3" y="3" width="50" height="50" rx="14" fill={`url(#${gBg})`} />
      <rect
        x="3"
        y="3"
        width="50"
        height="50"
        rx="14"
        fill="none"
        stroke={`url(#${gRing})`}
        strokeWidth="1.35"
        opacity={0.92}
      />
      <path
        d="M 17 18 L 28 36 L 39 18"
        fill="none"
        stroke={`url(#${gMark})`}
        strokeWidth="3.35"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M 17.5 36 H 38.5"
        stroke={`url(#${gMark})`}
        strokeWidth="2.4"
        strokeLinecap="round"
        opacity={0.92}
      />
      <circle cx="40" cy="16" r="2.25" fill="#c084fc" opacity={0.95} />
    </svg>
  );

  if (!wordmark) return svg;

  return (
    <span className="vprok-logo-lockup">
      {svg}
      <span className="vprok-logo-wordmark" aria-hidden="true">
        Vprok
      </span>
    </span>
  );
}
