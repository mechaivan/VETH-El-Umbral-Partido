type OrnamentProps = {
  className?: string;
};

/** Divisor ornamental gótico: líneas finas, púas y un diamante central. */
export function Ornament({ className = "" }: OrnamentProps) {
  return (
    <svg
      viewBox="0 0 360 28"
      fill="none"
      className={className}
      aria-hidden="true"
      preserveAspectRatio="xMidYMid meet"
    >
      <g stroke="currentColor" strokeWidth="1">
        <line x1="0" y1="14" x2="126" y2="14" opacity="0.5" />
        <line x1="234" y1="14" x2="360" y2="14" opacity="0.5" />
        <line x1="132" y1="9" x2="132" y2="19" opacity="0.6" />
        <line x1="228" y1="9" x2="228" y2="19" opacity="0.6" />
        <line x1="22" y1="11.5" x2="22" y2="16.5" opacity="0.4" />
        <line x1="338" y1="11.5" x2="338" y2="16.5" opacity="0.4" />
      </g>
      <path
        d="M180 3.5 L190.5 14 L180 24.5 L169.5 14 Z"
        stroke="currentColor"
        strokeWidth="1.2"
        fill="rgba(148,170,210,0.14)"
      />
      <circle cx="180" cy="14" r="2" fill="currentColor" />
      <path d="M154 14 L162 8 L162 20 Z" fill="currentColor" opacity="0.5" />
      <path d="M206 14 L198 8 L198 20 Z" fill="currentColor" opacity="0.5" />
      <circle cx="146" cy="14" r="1.5" fill="currentColor" opacity="0.7" />
      <circle cx="214" cy="14" r="1.5" fill="currentColor" opacity="0.7" />
    </svg>
  );
}
