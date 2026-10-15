import { useState, useId } from "react";

export type CloudAgentId = "cloud" | "spiky" | "pill" | "clover";

export interface CloudAgentMeta {
  id: CloudAgentId;
  name: string;
  role: string;
  labelColor: string;
}

export const CLOUD_AGENTS: CloudAgentMeta[] = [
  {
    id: "cloud",
    name: "Cloud Agent",
    role: "Full-Stack & PR Specialist",
    labelColor: "text-blue-600",
  },
  {
    id: "spiky",
    name: "Security Swarm",
    role: "Vulnerability & QA Hunter",
    labelColor: "text-purple-600",
  },
  {
    id: "pill",
    name: "Runner Bot",
    role: "CI/CD & Jest Healer",
    labelColor: "text-orange-600",
  },
  {
    id: "clover",
    name: "Browser Agent",
    role: "DOM & Visual Verification",
    labelColor: "text-emerald-600",
  },
];

interface CloudAgentProps {
  id: CloudAgentId;
  size?: number; // base size (default 64)
  isActive?: boolean;
  isHovered?: boolean;
  isJumping?: boolean;
  onSelect?: (id: CloudAgentId, name: string) => void;
  onHoverChange?: (hovered: boolean) => void;
}

export function CloudAgentItem({
  id,
  size = 64,
  isActive = false,
  isHovered = false,
  isJumping = false,
  onSelect,
  onHoverChange,
}: CloudAgentProps) {
  const [internalHover, setInternalHover] = useState(false);
  const [internalJumping, setInternalJumping] = useState(false);
  const rawId = useId();
  const uid = rawId.replace(/[^a-zA-Z0-9_-]/g, "");

  const hoveredState = isHovered || internalHover;
  const jumpingState = isJumping || internalJumping;
  const isSquinting = hoveredState || jumpingState;

  const handleClick = () => {
    const meta = CLOUD_AGENTS.find((a) => a.id === id);
    onSelect?.(id, meta?.name || id);
    setInternalJumping(true);
    setTimeout(() => {
      setInternalJumping(false);
    }, 650);
  };

  const handleMouseEnter = () => {
    setInternalHover(true);
    onHoverChange?.(true);
  };

  const handleMouseLeave = () => {
    setInternalHover(false);
    onHoverChange?.(false);
  };

  // Proportional dimensions per character
  let width = size;
  let height = Math.round(size * 0.8);
  if (id === "pill") {
    width = Math.round(size * 1.25);
    height = Math.round(size * 0.75);
  } else if (id === "spiky") {
    width = Math.round(size * 0.92);
    height = Math.round(size * 0.78);
  } else if (id === "clover") {
    width = Math.round(size * 0.96);
    height = Math.round(size * 0.76);
  }

  const meta = CLOUD_AGENTS.find((a) => a.id === id);

  return (
    <button
      type="button"
      onClick={handleClick}
      onTouchStart={handleClick}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className={`cloud-agent-hitbox group ${
        jumpingState ? "is-jumping" : ""
      } ${hoveredState ? "is-hovered" : ""} ${
        isActive ? "is-active" : ""
      }`}
      style={{
        width: width + 10,
        height: height + 16,
        padding: "0 5px 8px 5px",
      }}
      aria-label={`${meta?.name || id} - ${meta?.role || ""}`}
    >
      <div
        className="w-full h-full flex items-end justify-center pointer-events-none"
        style={{ width, height }}
      >
        {id === "cloud" && (
          <BlueCloudSvg
            uid={uid}
            width={width}
            height={height}
            isSquinting={isSquinting}
          />
        )}
        {id === "spiky" && (
          <PurpleCloudSvg
            uid={uid}
            width={width}
            height={height}
            isSquinting={isSquinting}
          />
        )}
        {id === "pill" && (
          <OrangeCloudSvg
            uid={uid}
            width={width}
            height={height}
            isSquinting={isSquinting}
          />
        )}
        {id === "clover" && (
          <EmeraldCloudSvg
            uid={uid}
            width={width}
            height={height}
            isSquinting={isSquinting}
          />
        )}
      </div>
    </button>
  );
}

/* -------------------------------------------------------------
   1. BLUE CLOUD (Cloud Agent · Classic Cumulus)
------------------------------------------------------------- */
function BlueCloudSvg({
  uid,
  width,
  height,
  isSquinting,
}: {
  uid: string;
  width: number;
  height: number;
  isSquinting: boolean;
}) {
  const cloudPath =
    "M 32,68 C 20,68 10,59 10,48 C 10,38 19,32 30,33 C 33,21 44,14 56,14 C 68,14 77,21 80,31 C 89,32 96,40 96,50 C 96,60 88,68 76,68 C 62,70 44,70 32,68 Z";

  return (
    <svg
      viewBox="0 0 106 78"
      width={width}
      height={height}
      className="overflow-visible"
      aria-hidden="true"
    >
      <defs>
        <radialGradient id={`blue-body-${uid}`} cx="48%" cy="38%" r="66%">
          <stop offset="0%" stopColor="#a0e2ff" />
          <stop offset="28%" stopColor="#4aa4ff" />
          <stop offset="68%" stopColor="#1f6ee8" />
          <stop offset="100%" stopColor="#1042b5" />
        </radialGradient>

        <linearGradient
          id={`blue-crescent-${uid}`}
          x1="0%"
          y1="0%"
          x2="0%"
          y2="100%"
        >
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.82" />
          <stop offset="55%" stopColor="#ffffff" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0.04" />
        </linearGradient>

        <clipPath id={`blue-clip-${uid}`}>
          <path d={cloudPath} />
        </clipPath>

        <filter id={`blue-soft-${uid}`} x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="3" />
        </filter>
        <filter id={`blue-fine-${uid}`} x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="0.75" />
        </filter>
        <filter id={`blue-wide-${uid}`} x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur stdDeviation="5" />
        </filter>
        <filter
          id={`blue-shadow-${uid}`}
          filterUnits="userSpaceOnUse"
          x="-10"
          y="60"
          width="126"
          height="26"
        >
          <feGaussianBlur stdDeviation="3" />
        </filter>
      </defs>

      {/* Shadow group (stays on ground, softens & shrinks during jump) */}
      <g
        className="cloud-agent-shadow"
        style={{ transformOrigin: "53px 73px" }}
      >
        <ellipse
          cx="53"
          cy="73"
          rx="33"
          ry="3.6"
          fill="#0f2b66"
          fillOpacity="0.18"
          filter={`url(#blue-shadow-${uid})`}
        />
      </g>

      {/* Body group (jumps up, squashes & stretches) */}
      <g
        className="cloud-agent-body"
        style={{ transformOrigin: "53px 73px" }}
      >
        <path d={cloudPath} fill={`url(#blue-body-${uid})`} />

        <g clipPath={`url(#blue-clip-${uid})`}>
          <ellipse
            cx="53"
            cy="65"
            rx="28"
            ry="9"
            fill="#7ed0ff"
            fillOpacity="0.32"
            filter={`url(#blue-wide-${uid})`}
          />
          <path
            d={cloudPath}
            fill="none"
            stroke="#092870"
            strokeOpacity="0.22"
            strokeWidth="5"
            filter={`url(#blue-soft-${uid})`}
          />
          <path
            d={cloudPath}
            fill="none"
            stroke="#ffffff"
            strokeOpacity="0.36"
            strokeWidth="2"
            filter={`url(#blue-fine-${uid})`}
          />
          <path
            d="M 36,30 C 39,21 47,16 56,16 C 65,16 73,21 76,30 C 71,23 64,19.5 56,19.5 C 48,19.5 41,23 36,30 Z"
            fill={`url(#blue-crescent-${uid})`}
          />
          <path
            d="M 39,26 C 42,18 48,15 56,15 C 64,15 70,18 73,26"
            fill="none"
            stroke="#ffffff"
            strokeWidth="3.2"
            strokeLinecap="round"
            strokeOpacity="0.4"
            filter={`url(#blue-soft-${uid})`}
          />
          <path
            d="M 41,24 C 44,17.5 49,15 56,15 C 63,15 68,17.5 71,24"
            fill="none"
            stroke="#ffffff"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeOpacity="0.95"
            filter={`url(#blue-fine-${uid})`}
          />
          <path
            d="M 45,21 C 48,17.5 52,16 56,16 C 60,16 64,17.5 67,21"
            fill="none"
            stroke="#ffffff"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeOpacity="1.0"
          />
          <path
            d="M 16,45 C 16,36.5 22,32 29,32.5"
            fill="none"
            stroke="#ffffff"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeOpacity="0.82"
            filter={`url(#blue-fine-${uid})`}
          />
          <path
            d="M 81,33 C 88,34 92,39 92.5,46"
            fill="none"
            stroke="#ffffff"
            strokeWidth="2"
            strokeLinecap="round"
            strokeOpacity="0.75"
            filter={`url(#blue-fine-${uid})`}
          />
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

        {/* Open Eyes */}
        <g
          className="cloud-agent-eyes-open"
          style={{
            transformBox: "fill-box",
            transformOrigin: "53px 43px",
            transition:
              "transform 0.22s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.18s ease-out",
            transform: isSquinting ? "scaleY(0.08)" : "scaleY(1)",
            opacity: isSquinting ? 0 : 1,
          }}
        >
          <ellipse cx="45.5" cy="43" rx="3.6" ry="5.2" fill="#091b38" />
          <ellipse cx="60.5" cy="43" rx="3.6" ry="5.2" fill="#091b38" />
          <circle cx="47" cy="41.2" r="1.5" fill="#ffffff" fillOpacity="0.95" />
          <circle cx="62" cy="41.2" r="1.5" fill="#ffffff" fillOpacity="0.95" />
          <circle cx="44.5" cy="44.5" r="0.8" fill="#ffffff" fillOpacity="0.75" />
          <circle cx="59.5" cy="44.5" r="0.8" fill="#ffffff" fillOpacity="0.75" />
        </g>

        {/* Closed / Happy Squint Eyes (^ ^) */}
        <g
          className="cloud-agent-eyes-squint"
          style={{
            transformBox: "fill-box",
            transformOrigin: "53px 43.5px",
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
            stroke="#091b38"
            strokeWidth="2.8"
            strokeLinecap="round"
          />
          <path
            d="M 57,43.5 Q 60.5,38 64,43.5"
            fill="none"
            stroke="#091b38"
            strokeWidth="2.8"
            strokeLinecap="round"
          />
        </g>
      </g>
    </svg>
  );
}

/* -------------------------------------------------------------
   2. PURPLE CLOUD (Security Swarm · Tall Tower)
------------------------------------------------------------- */
function PurpleCloudSvg({
  uid,
  width,
  height,
  isSquinting,
}: {
  uid: string;
  width: number;
  height: number;
  isSquinting: boolean;
}) {
  const cloudPath =
    "M 28,78 C 16,78 8,68 8,56 C 8,46 16,39 26,40 C 27,29 37,20 48,18 C 53,9 64,5 74,5 C 87,5 97,14 99,26 C 107,30 112,39 112,50 C 112,62 104,72 92,76 C 76,80 44,80 28,78 Z";

  return (
    <svg
      viewBox="0 0 106 88"
      width={width}
      height={height}
      className="overflow-visible"
      aria-hidden="true"
    >
      <defs>
        <radialGradient id={`purple-body-${uid}`} cx="50%" cy="32%" r="68%">
          <stop offset="0%" stopColor="#ede9fe" />
          <stop offset="26%" stopColor="#c4b5fd" />
          <stop offset="65%" stopColor="#8b5cf6" />
          <stop offset="100%" stopColor="#4c1d95" />
        </radialGradient>

        <linearGradient
          id={`purple-crescent-${uid}`}
          x1="0%"
          y1="0%"
          x2="0%"
          y2="100%"
        >
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.85" />
          <stop offset="55%" stopColor="#ffffff" stopOpacity="0.32" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0.04" />
        </linearGradient>

        <clipPath id={`purple-clip-${uid}`}>
          <path d={cloudPath} />
        </clipPath>

        <filter id={`purple-soft-${uid}`} x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="3" />
        </filter>
        <filter id={`purple-fine-${uid}`} x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="0.75" />
        </filter>
        <filter
          id={`purple-shadow-${uid}`}
          filterUnits="userSpaceOnUse"
          x="-10"
          y="70"
          width="132"
          height="26"
        >
          <feGaussianBlur stdDeviation="3" />
        </filter>
      </defs>

      {/* Shadow */}
      <g
        className="cloud-agent-shadow"
        style={{ transformOrigin: "60px 81.2px" }}
      >
        <ellipse
          cx="60"
          cy="81.2"
          rx="35"
          ry="3.8"
          fill="#2e1065"
          fillOpacity="0.18"
          filter={`url(#purple-shadow-${uid})`}
        />
      </g>

      {/* Body */}
      <g
        className="cloud-agent-body"
        style={{ transformOrigin: "60px 81px" }}
      >
        <path d={cloudPath} fill={`url(#purple-body-${uid})`} />

        <g clipPath={`url(#purple-clip-${uid})`}>
          <ellipse
            cx="60"
            cy="74"
            rx="30"
            ry="9"
            fill="#ddd6fe"
            fillOpacity="0.32"
            filter={`url(#purple-soft-${uid})`}
          />
          <path
            d="M 28,78 C 16,78 8,68 8,56 C 8,46 16,39 26,40 C 27,29 37,20 48,18 C 53,9 64,5 74,5 C 87,5 97,14 99,26 C 107,30 112,39 112,50 C 112,62 104,72 92,76 C 76,80 44,80 28,78 Z"
            fill="none"
            stroke="#3b0764"
            strokeOpacity="0.22"
            strokeWidth="5"
            filter={`url(#purple-soft-${uid})`}
          />
          <path
            d="M 28,78 C 16,78 8,68 8,56 C 8,46 16,39 26,40 C 27,29 37,20 48,18 C 53,9 64,5 74,5 C 87,5 97,14 99,26 C 107,30 112,39 112,50 C 112,62 104,72 92,76 C 76,80 44,80 28,78 Z"
            fill="none"
            stroke="#ffffff"
            strokeOpacity="0.36"
            strokeWidth="2"
            filter={`url(#purple-fine-${uid})`}
          />
          <path
            d="M 52,22 C 57,11 65,7 74,7 C 83,7 91,12 94,22 C 89,15 82,11 74,11 C 66,11 58,15 52,22 Z"
            fill={`url(#purple-crescent-${uid})`}
          />
          <path
            d="M 56,19 C 61,10 67,7 74,7 C 81,7 87,10 91,19"
            fill="none"
            stroke="#ffffff"
            strokeWidth="3.2"
            strokeLinecap="round"
            strokeOpacity="0.4"
            filter={`url(#purple-soft-${uid})`}
          />
          <path
            d="M 58,18 C 62,9.5 68,7 74,7 C 80,7 86,9.5 90,18"
            fill="none"
            stroke="#ffffff"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeOpacity="0.95"
            filter={`url(#purple-fine-${uid})`}
          />
          <path
            d="M 61,15 C 65,9.5 69,7.5 74,7.5 C 79,7.5 83,9.5 87,15"
            fill="none"
            stroke="#ffffff"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeOpacity="1.0"
          />
          <path
            d="M 14,52 C 14,43.5 19,40.5 26,40.5"
            fill="none"
            stroke="#ffffff"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeOpacity="0.82"
            filter={`url(#purple-fine-${uid})`}
          />
          <ellipse
            cx="82"
            cy="12"
            rx="3"
            ry="1.8"
            transform="rotate(-20 82 12)"
            fill="#ffffff"
            fillOpacity="1.0"
          />
          <circle cx="87" cy="14.5" r="1.3" fill="#ffffff" fillOpacity="0.95" />
        </g>

        {/* Open Eyes */}
        <g
          className="cloud-agent-eyes-open"
          style={{
            transformBox: "fill-box",
            transformOrigin: "61.5px 49px",
            transition:
              "transform 0.22s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.18s ease-out",
            transform: isSquinting ? "scaleY(0.08)" : "scaleY(1)",
            opacity: isSquinting ? 0 : 1,
          }}
        >
          <ellipse cx="54" cy="49" rx="3.6" ry="5.2" fill="#1e1b4b" />
          <ellipse cx="69" cy="49" rx="3.6" ry="5.2" fill="#1e1b4b" />
          <circle cx="55.5" cy="47.2" r="1.5" fill="#ffffff" fillOpacity="0.95" />
          <circle cx="70.5" cy="47.2" r="1.5" fill="#ffffff" fillOpacity="0.95" />
          <circle cx="53" cy="50.5" r="0.8" fill="#ffffff" fillOpacity="0.75" />
          <circle cx="68" cy="50.5" r="0.8" fill="#ffffff" fillOpacity="0.75" />
        </g>

        {/* Closed Eyes */}
        <g
          className="cloud-agent-eyes-squint"
          style={{
            transformBox: "fill-box",
            transformOrigin: "61.5px 48px",
            transition:
              "transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.2s ease-out",
            transform: isSquinting ? "scaleY(1)" : "scaleY(0.12)",
            opacity: isSquinting ? 1 : 0,
            pointerEvents: "none",
          }}
        >
          <path
            d="M 50.5,50 Q 54,44 57.5,50"
            fill="none"
            stroke="#1e1b4b"
            strokeWidth="2.8"
            strokeLinecap="round"
          />
          <path
            d="M 65.5,50 Q 69,44 72.5,50"
            fill="none"
            stroke="#1e1b4b"
            strokeWidth="2.8"
            strokeLinecap="round"
          />
        </g>
      </g>
    </svg>
  );
}

/* -------------------------------------------------------------
   3. ORANGE CLOUD (Runner Bot · Wide Stratus)
------------------------------------------------------------- */
function OrangeCloudSvg({
  uid,
  width,
  height,
  isSquinting,
}: {
  uid: string;
  width: number;
  height: number;
  isSquinting: boolean;
}) {
  const cloudPath =
    "M 24,62 C 12,62 4,53 4,43 C 4,33 13,27 23,27 C 27,19 37,14 48,14 C 57,14 65,18 70,23 C 76,17 86,15 96,17 C 105,19 112,26 114,34 C 122,36 128,44 128,52 C 128,60 120,64 110,64 C 88,65 48,65 24,62 Z";

  return (
    <svg
      viewBox="0 0 120 72"
      width={width}
      height={height}
      className="overflow-visible"
      aria-hidden="true"
    >
      <defs>
        <radialGradient id={`orange-body-${uid}`} cx="50%" cy="36%" r="68%">
          <stop offset="0%" stopColor="#ffedd5" />
          <stop offset="26%" stopColor="#fed7aa" />
          <stop offset="65%" stopColor="#f97316" />
          <stop offset="100%" stopColor="#9a3412" />
        </radialGradient>

        <linearGradient
          id={`orange-crescent-${uid}`}
          x1="0%"
          y1="0%"
          x2="0%"
          y2="100%"
        >
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.85" />
          <stop offset="55%" stopColor="#ffffff" stopOpacity="0.32" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0.04" />
        </linearGradient>

        <clipPath id={`orange-clip-${uid}`}>
          <path d={cloudPath} />
        </clipPath>

        <filter id={`orange-soft-${uid}`} x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="3" />
        </filter>
        <filter id={`orange-fine-${uid}`} x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="0.75" />
        </filter>
        <filter
          id={`orange-shadow-${uid}`}
          filterUnits="userSpaceOnUse"
          x="-10"
          y="55"
          width="148"
          height="26"
        >
          <feGaussianBlur stdDeviation="3" />
        </filter>
      </defs>

      {/* Shadow */}
      <g
        className="cloud-agent-shadow"
        style={{ transformOrigin: "66px 65.9px" }}
      >
        <ellipse
          cx="66"
          cy="65.9"
          rx="42"
          ry="3.6"
          fill="#431407"
          fillOpacity="0.16"
          filter={`url(#orange-shadow-${uid})`}
        />
      </g>

      {/* Body */}
      <g
        className="cloud-agent-body"
        style={{ transformOrigin: "66px 65px" }}
      >
        <path d={cloudPath} fill={`url(#orange-body-${uid})`} />

        <g clipPath={`url(#orange-clip-${uid})`}>
          <ellipse
            cx="66"
            cy="58"
            rx="34"
            ry="8"
            fill="#fed7aa"
            fillOpacity="0.32"
            filter={`url(#orange-soft-${uid})`}
          />
          {/* Inner shadow/ambient rim */}
          <path
            d={cloudPath}
            fill="none"
            stroke="#7c2d12"
            strokeOpacity="0.16"
            strokeWidth="3.5"
            filter={`url(#orange-soft-${uid})`}
          />

          {/* Left Lobe Specular Highlight - Smooth, organic, perfectly blended */}
          <path
            d="M 38,22 C 41,17 44.5,15.5 48,15.5 C 51.5,15.5 55,17 58,22"
            fill="none"
            stroke="#ffffff"
            strokeWidth="2.6"
            strokeLinecap="round"
            strokeOpacity="0.45"
            filter={`url(#orange-soft-${uid})`}
          />
          <path
            d="M 40,20.5 C 43,16.5 45.5,15.2 48,15.2 C 50.5,15.2 53,16.5 56,20.5"
            fill="none"
            stroke="#ffffff"
            strokeWidth="1.4"
            strokeLinecap="round"
            strokeOpacity="0.85"
            filter={`url(#orange-fine-${uid})`}
          />
          <ellipse
            cx="46"
            cy="17"
            rx="2.8"
            ry="1.5"
            transform="rotate(-15 46 17)"
            fill="#ffffff"
            fillOpacity="0.9"
          />

          {/* Right Lobe Specular Highlight - Smooth, organic, perfectly blended */}
          <path
            d="M 81,21 C 84.5,17.5 88,16.2 92,16.2 C 96,16.2 99.5,17.5 103,21"
            fill="none"
            stroke="#ffffff"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeOpacity="0.4"
            filter={`url(#orange-soft-${uid})`}
          />
          <path
            d="M 83,19.5 C 86,16.8 89,15.8 92,15.8 C 95,15.8 98,16.8 101,19.5"
            fill="none"
            stroke="#ffffff"
            strokeWidth="1.4"
            strokeLinecap="round"
            strokeOpacity="0.8"
            filter={`url(#orange-fine-${uid})`}
          />
          <ellipse
            cx="93"
            cy="17.5"
            rx="2.6"
            ry="1.4"
            transform="rotate(-15 93 17.5)"
            fill="#ffffff"
            fillOpacity="0.9"
          />
        </g>

        {/* Open Eyes */}
        <g
          className="cloud-agent-eyes-open"
          style={{
            transformBox: "fill-box",
            transformOrigin: "65.5px 42px",
            transition:
              "transform 0.22s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.18s ease-out",
            transform: isSquinting ? "scaleY(0.08)" : "scaleY(1)",
            opacity: isSquinting ? 0 : 1,
          }}
        >
          <ellipse cx="58" cy="42" rx="3.6" ry="5.2" fill="#431407" />
          <ellipse cx="73" cy="42" rx="3.6" ry="5.2" fill="#431407" />
          <circle cx="59.5" cy="40.2" r="1.5" fill="#ffffff" fillOpacity="0.95" />
          <circle cx="74.5" cy="40.2" r="1.5" fill="#ffffff" fillOpacity="0.95" />
          <circle cx="57" cy="43.5" r="0.8" fill="#ffffff" fillOpacity="0.75" />
          <circle cx="72" cy="43.5" r="0.8" fill="#ffffff" fillOpacity="0.75" />
        </g>

        {/* Closed Eyes */}
        <g
          className="cloud-agent-eyes-squint"
          style={{
            transformBox: "fill-box",
            transformOrigin: "65.5px 41px",
            transition:
              "transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.2s ease-out",
            transform: isSquinting ? "scaleY(1)" : "scaleY(0.12)",
            opacity: isSquinting ? 1 : 0,
            pointerEvents: "none",
          }}
        >
          <path
            d="M 54.5,43 Q 58,37 61.5,43"
            fill="none"
            stroke="#431407"
            strokeWidth="2.8"
            strokeLinecap="round"
          />
          <path
            d="M 69.5,43 Q 73,37 76.5,43"
            fill="none"
            stroke="#431407"
            strokeWidth="2.8"
            strokeLinecap="round"
          />
        </g>
      </g>
    </svg>
  );
}

/* -------------------------------------------------------------
   4. EMERALD CLOUD (Browser Agent · Chubby Bubble)
------------------------------------------------------------- */
function EmeraldCloudSvg({
  uid,
  width,
  height,
  isSquinting,
}: {
  uid: string;
  width: number;
  height: number;
  isSquinting: boolean;
}) {
  const cloudPath =
    "M 26,66 C 14,66 6,56 6,45 C 6,34 16,27 26,28 C 30,16 42,10 54,10 C 66,10 76,17 78,28 C 88,30 94,39 94,50 C 94,60 86,67 74,67 C 60,68 40,68 26,66 Z";

  return (
    <svg
      viewBox="0 0 96 76"
      width={width}
      height={height}
      className="overflow-visible"
      aria-hidden="true"
    >
      <defs>
        <radialGradient id={`emerald-body-${uid}`} cx="48%" cy="38%" r="66%">
          <stop offset="0%" stopColor="#d1fae5" />
          <stop offset="22%" stopColor="#6ee7b7" />
          <stop offset="60%" stopColor="#10b981" />
          <stop offset="100%" stopColor="#047857" />
        </radialGradient>

        <linearGradient
          id={`emerald-crescent-${uid}`}
          x1="0%"
          y1="0%"
          x2="0%"
          y2="100%"
        >
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.88" />
          <stop offset="55%" stopColor="#ffffff" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0.04" />
        </linearGradient>

        <clipPath id={`emerald-clip-${uid}`}>
          <path d={cloudPath} />
        </clipPath>

        <filter id={`emerald-soft-${uid}`} x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="3" />
        </filter>
        <filter id={`emerald-fine-${uid}`} x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="0.75" />
        </filter>
        <filter
          id={`emerald-shadow-${uid}`}
          filterUnits="userSpaceOnUse"
          x="-10"
          y="58"
          width="116"
          height="26"
        >
          <feGaussianBlur stdDeviation="3" />
        </filter>
      </defs>

      {/* Shadow */}
      <g
        className="cloud-agent-shadow"
        style={{ transformOrigin: "50px 69.8px" }}
      >
        <ellipse
          cx="50"
          cy="69.8"
          rx="32"
          ry="3.6"
          fill="#064e3b"
          fillOpacity="0.16"
          filter={`url(#emerald-shadow-${uid})`}
        />
      </g>

      {/* Body */}
      <g
        className="cloud-agent-body"
        style={{ transformOrigin: "50px 69px" }}
      >
        <path d={cloudPath} fill={`url(#emerald-body-${uid})`} />

        <g clipPath={`url(#emerald-clip-${uid})`}>
          <ellipse
            cx="50"
            cy="62"
            rx="26"
            ry="8"
            fill="#6ee7b7"
            fillOpacity="0.35"
            filter={`url(#emerald-soft-${uid})`}
          />
          <path
            d="M 26,66 C 14,66 6,56 6,45 C 6,34 16,27 26,28 C 30,16 42,10 54,10 C 66,10 76,17 78,28 C 88,30 94,39 94,50 C 94,60 86,67 74,67 C 60,68 40,68 26,66 Z"
            fill="none"
            stroke="#047857"
            strokeOpacity="0.22"
            strokeWidth="5"
            filter={`url(#emerald-soft-${uid})`}
          />
          <path
            d="M 26,66 C 14,66 6,56 6,45 C 6,34 16,27 26,28 C 30,16 42,10 54,10 C 66,10 76,17 78,28 C 88,30 94,39 94,50 C 94,60 86,67 74,67 C 60,68 40,68 26,66 Z"
            fill="none"
            stroke="#ffffff"
            strokeOpacity="0.36"
            strokeWidth="2"
            filter={`url(#emerald-fine-${uid})`}
          />
          <path
            d="M 34,26 C 38,18 46,14 54,14 C 62,14 70,18 73,26 C 68,20 61,17 54,17 C 47,17 40,20 34,26 Z"
            fill={`url(#emerald-crescent-${uid})`}
          />
          <path
            d="M 38,23 C 42,16 48,14 54,14 C 60,14 66,16 70,23"
            fill="none"
            stroke="#ffffff"
            strokeWidth="3.2"
            strokeLinecap="round"
            strokeOpacity="0.4"
            filter={`url(#emerald-soft-${uid})`}
          />
          <path
            d="M 40,21 C 44,15.5 49,14 54,14 C 59,14 64,15.5 68,21"
            fill="none"
            stroke="#ffffff"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeOpacity="0.95"
            filter={`url(#emerald-fine-${uid})`}
          />
          <path
            d="M 44,18 C 47,15 50.5,14 54,14 C 57.5,14 61,15 64,18"
            fill="none"
            stroke="#ffffff"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeOpacity="1.0"
          />
          <ellipse
            cx="62"
            cy="16.5"
            rx="2.9"
            ry="1.7"
            transform="rotate(-20 62 16.5)"
            fill="#ffffff"
            fillOpacity="1.0"
          />
          <circle cx="67" cy="19" r="1.2" fill="#ffffff" fillOpacity="0.95" />
        </g>

        {/* Open Eyes */}
        <g
          className="cloud-agent-eyes-open"
          style={{
            transformBox: "fill-box",
            transformOrigin: "50.5px 42px",
            transition:
              "transform 0.22s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.18s ease-out",
            transform: isSquinting ? "scaleY(0.08)" : "scaleY(1)",
            opacity: isSquinting ? 0 : 1,
          }}
        >
          <ellipse cx="43" cy="42" rx="3.6" ry="5.2" fill="#064e3b" />
          <ellipse cx="58" cy="42" rx="3.6" ry="5.2" fill="#064e3b" />
          <circle cx="44.5" cy="40.2" r="1.5" fill="#ffffff" fillOpacity="0.95" />
          <circle cx="59.5" cy="40.2" r="1.5" fill="#ffffff" fillOpacity="0.95" />
          <circle cx="42" cy="43.5" r="0.8" fill="#ffffff" fillOpacity="0.75" />
          <circle cx="57" cy="43.5" r="0.8" fill="#ffffff" fillOpacity="0.75" />
        </g>

        {/* Closed Eyes */}
        <g
          className="cloud-agent-eyes-squint"
          style={{
            transformBox: "fill-box",
            transformOrigin: "50.5px 41px",
            transition:
              "transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.2s ease-out",
            transform: isSquinting ? "scaleY(1)" : "scaleY(0.12)",
            opacity: isSquinting ? 1 : 0,
            pointerEvents: "none",
          }}
        >
          <path
            d="M 39.5,43 Q 43,37 46.5,43"
            fill="none"
            stroke="#064e3b"
            strokeWidth="2.8"
            strokeLinecap="round"
          />
          <path
            d="M 54.5,43 Q 58,37 61.5,43"
            fill="none"
            stroke="#064e3b"
            strokeWidth="2.8"
            strokeLinecap="round"
          />
        </g>
      </g>
    </svg>
  );
}

/* -------------------------------------------------------------
   Export Stylesheet for the Jump Animation & Smooth Eye Closing
------------------------------------------------------------- */
export function CloudAgentsStyles() {
  return (
    <style>{`
      .cloud-agent-hitbox {
        position: relative;
        outline: none;
        cursor: pointer;
        background: transparent;
        border: none;
        display: inline-flex;
        align-items: flex-end;
        justify-content: center;
        user-select: none;
        -webkit-tap-highlight-color: transparent;
        transition: transform 0.2s ease;
      }

      .cloud-agent-hitbox:active {
        transform: scale(0.96);
      }

      /* Body default resting state */
      .cloud-agent-body {
        transform-origin: center bottom;
        transition: transform 0.45s cubic-bezier(0.34, 1.56, 0.64, 1);
        transform: translateY(0) scale(1, 1);
      }

      /* Shadow default resting state */
      .cloud-agent-shadow {
        transform-origin: center center;
        transition: transform 0.45s ease-out, opacity 0.45s ease-out;
        transform: scale(1);
        opacity: 1;
      }

      /* Open eyes smooth closing transition */
      .cloud-agent-eyes-open {
        transform-box: fill-box;
        transform-origin: center center;
        transition: transform 0.22s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.18s ease-out;
      }

      /* Closed squint eyes smooth opening transition */
      .cloud-agent-eyes-squint {
        transform-box: fill-box;
        transform-origin: center center;
        transition: transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.22s ease-out;
      }

      /* JUMP OFF ANIMATION (On Hover) */
      @keyframes agentHoverJumpOff {
        0% {
          transform: translateY(0) scale(1, 1);
        }
        14% {
          transform: translateY(3.5px) scale(1.14, 0.86);
        }
        42% {
          transform: translateY(-24px) scale(0.92, 1.15);
        }
        68% {
          transform: translateY(-8px) scale(1.05, 0.95);
        }
        84% {
          transform: translateY(-16px) scale(0.98, 1.02);
        }
        100% {
          transform: translateY(-13px) scale(1.04, 1.04);
        }
      }

      @keyframes agentHoverShadow {
        0% {
          transform: scale(1);
          opacity: 1;
        }
        14% {
          transform: scale(1.16);
          opacity: 1.15;
        }
        42% {
          transform: scale(0.62);
          opacity: 0.35;
        }
        68% {
          transform: scale(0.88);
          opacity: 0.75;
        }
        84% {
          transform: scale(0.74);
          opacity: 0.55;
        }
        100% {
          transform: scale(0.78);
          opacity: 0.6;
        }
      }

      /* Trigger Jump on Hover or when is-hovered */
      .cloud-agent-hitbox:hover .cloud-agent-body,
      .cloud-agent-hitbox.is-hovered .cloud-agent-body {
        animation: agentHoverJumpOff 0.62s cubic-bezier(0.25, 1, 0.5, 1) forwards !important;
      }

      .cloud-agent-hitbox:hover .cloud-agent-shadow,
      .cloud-agent-hitbox.is-hovered .cloud-agent-shadow {
        animation: agentHoverShadow 0.62s cubic-bezier(0.25, 1, 0.5, 1) forwards !important;
      }

      /* Smooth Eyes Closing on Hover */
      .cloud-agent-hitbox:hover .cloud-agent-eyes-open,
      .cloud-agent-hitbox.is-hovered .cloud-agent-eyes-open,
      .cloud-agent-hitbox.is-jumping .cloud-agent-eyes-open {
        transform: scaleY(0.08) !important;
        opacity: 0 !important;
      }

      .cloud-agent-hitbox:hover .cloud-agent-eyes-squint,
      .cloud-agent-hitbox.is-hovered .cloud-agent-eyes-squint,
      .cloud-agent-hitbox.is-jumping .cloud-agent-eyes-squint {
        transform: scaleY(1) !important;
        opacity: 1 !important;
      }

      /* Full Leap and Return to Ground (On Click/Tap) */
      @keyframes agentFullClickJump {
        0% { transform: translateY(0) scale(1, 1); }
        14% { transform: translateY(3.5px) scale(1.14, 0.86); }
        42% { transform: translateY(-28px) scale(0.9, 1.18); }
        70% { transform: translateY(2px) scale(1.1, 0.9); }
        85% { transform: translateY(-4px) scale(0.98, 1.02); }
        100% { transform: translateY(0) scale(1, 1); }
      }

      @keyframes agentFullClickShadow {
        0% { transform: scale(1); opacity: 1; }
        14% { transform: scale(1.16); opacity: 1.15; }
        42% { transform: scale(0.58); opacity: 0.32; }
        70% { transform: scale(1.12); opacity: 1.1; }
        85% { transform: scale(0.95); opacity: 0.9; }
        100% { transform: scale(1); opacity: 1; }
      }

      .cloud-agent-hitbox.is-jumping .cloud-agent-body {
        animation: agentFullClickJump 0.65s cubic-bezier(0.25, 1, 0.5, 1) forwards !important;
      }

      .cloud-agent-hitbox.is-jumping .cloud-agent-shadow {
        animation: agentFullClickShadow 0.65s cubic-bezier(0.25, 1, 0.5, 1) forwards !important;
      }

      /* Active Selected Floating State */
      .cloud-agent-hitbox.is-active:not(:hover) .cloud-agent-body {
        transform: translateY(-5px) scale(1.05);
      }
      .cloud-agent-hitbox.is-active:not(:hover) .cloud-agent-shadow {
        transform: scale(0.9);
        opacity: 0.8;
      }
    `}</style>
  );
}
