import { useId } from "react";

export type LogoVariant = "blue" | "purple" | "orange" | "lime";

type AgentLogoProps = {
  size?: number;
  className?: string;
  showShadow?: boolean;
  variant?: LogoVariant;
  isSquinting?: boolean;
  isAnimated?: boolean;
};

const themes: Record<
  LogoVariant,
  {
    gradient: [string, string, string, string];
    bounce: string;
    shadowStroke: string;
    contactShadow: string;
    eyes: string;
  }
> = {
  blue: {
    gradient: ["#a0e2ff", "#4aa4ff", "#1f6ee8", "#1042b5"],
    bounce: "#7ed0ff",
    shadowStroke: "#092870",
    contactShadow: "#0f2b66",
    eyes: "#091b38",
  },
  purple: {
    gradient: ["#ede9fe", "#c4b5fd", "#8b5cf6", "#5b21b6"],
    bounce: "#ddd6fe",
    shadowStroke: "#3b0764",
    contactShadow: "#2e1065",
    eyes: "#1e1b4b",
  },
  orange: {
    gradient: ["#ffedd5", "#fed7aa", "#f97316", "#9a3412"],
    bounce: "#fed7aa",
    shadowStroke: "#7c2d12",
    contactShadow: "#431407",
    eyes: "#431407",
  },
  lime: {
    gradient: ["#fef9c3", "#ecfccb", "#bef264", "#4d7c0f"],
    bounce: "#d9f99d",
    shadowStroke: "#365314",
    contactShadow: "#14532d",
    eyes: "#14532d",
  },
};

export function AgentLogo({
  size = 38,
  className = "",
  showShadow = true,
  variant = "blue",
  isSquinting = false,
  isAnimated = false,
}: AgentLogoProps) {
  const rawId = useId();
  const id = rawId.replace(/[^a-zA-Z0-9_-]/g, "");
  const width = size;
  const height = Math.round(size * (78 / 106));
  const t = themes[variant] ?? themes.blue;

  const cloudPath =
    "M 32,68 C 20,68 10,59 10,48 C 10,38 19,32 30,33 C 33,21 44,14 56,14 C 68,14 77,21 80,31 C 89,32 96,40 96,50 C 96,60 88,68 76,68 C 62,70 44,70 32,68 Z";

  return (
    <span
      className={`agent-logo-wrapper n1e-Xq_give ${isAnimated ? "agent-animated" : ""} ${className}`}
      style={{
        width,
        height,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        position: "relative",
        flexShrink: 0,
      }}
      aria-label="Cloud Agent Jelly Bot"
      role="img"
    >
      <svg
        className="_U4Qta_body"
        viewBox="0 0 106 78"
        width={width}
        height={height}
        aria-hidden="true"
        style={{ width: "100%", height: "100%", overflow: "visible" }}
      >
        <defs>
          {/* Rich 3D volumetric radial gradient */}
          <radialGradient id={`jelly-${id}-body`} cx="48%" cy="38%" r="66%">
            <stop offset="0%" stopColor={t.gradient[0]} />
            <stop offset="28%" stopColor={t.gradient[1]} />
            <stop offset="68%" stopColor={t.gradient[2]} />
            <stop offset="100%" stopColor={t.gradient[3]} />
          </radialGradient>

          {/* Smooth crescent gloss gradient */}
          <linearGradient
            id={`jelly-${id}-top-crescent`}
            x1="0%"
            y1="0%"
            x2="0%"
            y2="100%"
          >
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.82" />
            <stop offset="55%" stopColor="#ffffff" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#ffffff" stopOpacity="0.04" />
          </linearGradient>

          <clipPath id={`jelly-${id}-clip`}>
            <path d={cloudPath} />
          </clipPath>

          <filter
            id={`jelly-${id}-soft`}
            x="-20%"
            y="-20%"
            width="140%"
            height="140%"
          >
            <feGaussianBlur stdDeviation="3" />
          </filter>
          <filter
            id={`jelly-${id}-fine`}
            x="-20%"
            y="-20%"
            width="140%"
            height="140%"
          >
            <feGaussianBlur stdDeviation="0.75" />
          </filter>
          <filter
            id={`jelly-${id}-wide`}
            x="-40%"
            y="-40%"
            width="180%"
            height="180%"
          >
            <feGaussianBlur stdDeviation="5" />
          </filter>
          <filter
            id={`jelly-${id}-shadow`}
            filterUnits="userSpaceOnUse"
            x="-10"
            y="60"
            width="126"
            height="26"
          >
            <feGaussianBlur stdDeviation="3" />
          </filter>
        </defs>

        {/* Clean floating contact shadow */}
        {showShadow && (
          <ellipse
            cx="53"
            cy="73"
            rx="33"
            ry="3.6"
            fill={t.contactShadow}
            fillOpacity="0.16"
            filter={`url(#jelly-${id}-shadow)`}
          />
        )}

        {/* Jelly Cloud Body */}
        <path d={cloudPath} fill={`url(#jelly-${id}-body)`} />

        {/* Glassy 3D Reflections and Highlights */}
        <g clipPath={`url(#jelly-${id}-clip)`}>
          {/* Subsurface ambient bounce lighting near bottom */}
          <ellipse
            cx="53"
            cy="65"
            rx="28"
            ry="9"
            fill={t.bounce}
            fillOpacity="0.32"
            filter={`url(#jelly-${id}-wide)`}
          />

          {/* Subtle bottom shadow depth */}
          <path
            d={cloudPath}
            fill="none"
            stroke={t.shadowStroke}
            strokeOpacity="0.22"
            strokeWidth="5"
            filter={`url(#jelly-${id}-soft)`}
          />

          {/* Delicate crisp glass inner rim */}
          <path
            d={cloudPath}
            fill="none"
            stroke="#ffffff"
            strokeOpacity="0.36"
            strokeWidth="2"
            filter={`url(#jelly-${id}-fine)`}
          />

          {/* Top Dome curved glossy crescent */}
          <path
            d="M 36,30 C 39,21 47,16 56,16 C 65,16 73,21 76,30 C 71,23 64,19.5 56,19.5 C 48,19.5 41,23 36,30 Z"
            fill={`url(#jelly-${id}-top-crescent)`}
          />

          {/* Top Dome glassy crest highlight - Professional polished white optical glass shine */}
          <path
            d="M 39,26 C 42,18 48,15 56,15 C 64,15 70,18 73,26"
            fill="none"
            stroke="#ffffff"
            strokeWidth="3.2"
            strokeLinecap="round"
            strokeOpacity="0.4"
            filter={`url(#jelly-${id}-soft)`}
          />
          <path
            d="M 41,24 C 44,17.5 49,15 56,15 C 63,15 68,17.5 71,24"
            fill="none"
            stroke="#ffffff"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeOpacity="0.95"
            filter={`url(#jelly-${id}-fine)`}
          />
          <path
            d="M 45,21 C 48,17.5 52,16 56,16 C 60,16 64,17.5 67,21"
            fill="none"
            stroke="#ffffff"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeOpacity="1.0"
          />

          {/* Left lobe crisp rim highlight */}
          <path
            d="M 16,45 C 16,36.5 22,32 29,32.5"
            fill="none"
            stroke="#ffffff"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeOpacity="0.82"
            filter={`url(#jelly-${id}-fine)`}
          />

          {/* Right lobe crisp rim highlight */}
          <path
            d="M 81,33 C 88,34 92,39 92.5,46"
            fill="none"
            stroke="#ffffff"
            strokeWidth="2"
            strokeLinecap="round"
            strokeOpacity="0.75"
            filter={`url(#jelly-${id}-fine)`}
          />

          {/* Specular glints */}
          <ellipse
            cx="64"
            cy="20"
            rx="3"
            ry="1.8"
            transform="rotate(-20 64 20)"
            fill="#ffffff"
            fillOpacity="1.0"
          />
          <circle cx="70.5" cy="23" r="1.4" fill="#ffffff" fillOpacity="0.95" />
        </g>

        {/* Expressive Bot Eyes with smooth squint transition */}
        <g
          className={`agent-bot-eyes agent-eyes-open ${isSquinting ? "is-squinting" : ""}`}
          style={{
            transformBox: "fill-box",
            transformOrigin: "center center",
            transition:
              "transform 0.18s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.15s ease-out",
            opacity: isSquinting ? 0 : 1,
            ...(isSquinting ? { transform: "scaleY(0.08)" } : {}),
          }}
        >
          <ellipse cx="45.5" cy="43" rx="3.6" ry="5.2" fill={t.eyes} />
          <ellipse cx="60.5" cy="43" rx="3.6" ry="5.2" fill={t.eyes} />
          {/* Primary eye shines */}
          <circle cx="47" cy="41.2" r="1.5" fill="#ffffff" fillOpacity="0.95" />
          <circle cx="62" cy="41.2" r="1.5" fill="#ffffff" fillOpacity="0.95" />
          {/* Secondary cute micro-shines */}
          <circle cx="44.5" cy="44.5" r="0.8" fill="#ffffff" fillOpacity="0.75" />
          <circle cx="59.5" cy="44.5" r="0.8" fill="#ffffff" fillOpacity="0.75" />
        </g>

        <g
          className="agent-bot-eyes-squint agent-eyes-closed"
          style={{
            transformBox: "fill-box",
            transformOrigin: "center center",
            transition:
              "transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.2s ease-out",
            transform: isSquinting ? "scaleY(1)" : "scaleY(0.12)",
            opacity: isSquinting ? 1 : 0,
            pointerEvents: "none",
          }}
        >
          <path
            d="M 42,43.5 Q 45.5,38 49,43.5"
            fill="none"
            stroke={t.eyes}
            strokeWidth="2.8"
            strokeLinecap="round"
          />
          <path
            d="M 57,43.5 Q 60.5,38 64,43.5"
            fill="none"
            stroke={t.eyes}
            strokeWidth="2.8"
            strokeLinecap="round"
          />
        </g>
      </svg>
    </span>
  );
}
