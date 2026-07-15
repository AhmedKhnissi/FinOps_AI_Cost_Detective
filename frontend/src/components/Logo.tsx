// Brand mark for FinOps AI Cost Detective.
//
// A magnifying glass (the "detective") sweeping over a stylized Azure cloud,
// with a small cost-spark — rendered as a self-contained inline SVG so it stays
// crisp at any size and inherits the sky-blue brand gradient.

interface LogoProps {
  size?: number;
  className?: string;
  /** Render the wordmark next to the icon. */
  withText?: boolean;
}

/** Square app-icon mark only. */
export function Logo({ size = 32, className = "" }: LogoProps) {
  const id = "finops-logo-grad";
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      role="img"
      aria-label="FinOps AI Cost Detective logo"
    >
      <defs>
        <linearGradient id={id} x1="6" y1="6" x2="42" y2="42" gradientUnits="userSpaceOnUse">
          <stop stopColor="#7dd3fc" />
          <stop offset="0.5" stopColor="#38bdf8" />
          <stop offset="1" stopColor="#0ea5e9" />
        </linearGradient>
      </defs>

      {/* Tile */}
      <rect x="2" y="2" width="44" height="44" rx="12" fill={`url(#${id})`} />
      <rect
        x="2.5"
        y="2.5"
        width="43"
        height="43"
        rx="11.5"
        fill="none"
        stroke="white"
        strokeOpacity="0.25"
      />

      {/* Cloud (Azure) */}
      <path
        d="M15 31c-3.3 0-6-2.5-6-5.6 0-3 2.4-5.4 5.4-5.6.5-3.4 3.5-6 7-6 2.8 0 5.2 1.6 6.4 4 1-.7 2.2-1.1 3.5-1.1 3.2 0 5.7 2.5 5.7 5.6 0 .4 0 .7-.1 1.1 1.9.6 3.1 2.4 3.1 4.5 0 2.6-2.1 4.6-4.7 4.6H15z"
        fill="white"
        fillOpacity="0.92"
      />

      {/* Magnifier lens + handle */}
      <circle cx="21.5" cy="20.5" r="7" fill="#0b0f17" fillOpacity="0.18" />
      <circle cx="21.5" cy="20.5" r="7" fill="none" stroke="#0b0f17" strokeOpacity="0.5" strokeWidth="2" />
      <line
        x1="26.6"
        y1="25.6"
        x2="32"
        y2="31"
        stroke="#0b0f17"
        strokeOpacity="0.6"
        strokeWidth="3.2"
        strokeLinecap="round"
      />

      {/* Cost spark inside the lens */}
      <path
        d="M18 23.2l2.2-3.4 1.8 2.4 2-3.1 1.6 4.1"
        fill="none"
        stroke="white"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Icon + "FinOps Cost Detective" wordmark. */
export function LogoWordmark({ size = 32, className = "" }: LogoProps) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <Logo size={size} />
      <span className="text-lg font-bold tracking-tight text-slate-100">
        FinOps <span className="gradient-text">Cost Detective</span>
      </span>
    </span>
  );
}

export default Logo;
