/**
 * Next Job Spy brand mark — a flat-SVG recreation of the logo. A magnifying
 * glass (the "spy") holding an upward trend line (the "next" — career
 * momentum). The ink strokes use `currentColor`, so the mark inherits the
 * surrounding text colour and stays legible in both light and dark themes; the
 * accent is a fixed brand blue.
 */

export const BRAND_BLUE = '#2E84E4';

/** Icon-only mark. Decorative — pair it with a visible/aria label. */
export function LogoMark({ size = 28 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      aria-hidden="true"
    >
      <circle cx="20" cy="20" r="13" stroke="currentColor" strokeWidth="4.2" />
      <line
        x1="30"
        y1="30"
        x2="40"
        y2="40"
        stroke="currentColor"
        strokeWidth="5"
        strokeLinecap="round"
      />
      <polyline
        points="12,17 19,26 23.95,18.58"
        stroke={BRAND_BLUE}
        strokeWidth="3.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M27 14 L26.78 20.47 L21.12 16.69 Z" fill={BRAND_BLUE} />
    </svg>
  );
}

/** Full horizontal lockup: mark + "Next Job Spy" wordmark. */
export function Logo({ size = 26 }: { size?: number }) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 9,
        color: 'var(--mantine-color-text)',
        lineHeight: 1,
      }}
    >
      <LogoMark size={size} />
      <span
        style={{
          fontWeight: 600,
          fontSize: Math.round(size * 0.66),
          letterSpacing: '-0.012em',
          whiteSpace: 'nowrap',
        }}
      >
        Next Job <span style={{ color: BRAND_BLUE }}>Spy</span>
      </span>
    </span>
  );
}
