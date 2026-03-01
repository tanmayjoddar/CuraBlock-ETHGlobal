/**
 * CuraBlock brand logo — blockchain shield with connected blocks.
 * Outer shield shape + inner interlocking cube/chain mark, gradient fill.
 */
const CuraBlockLogo = ({
  size = 36,
  className = "",
}: {
  size?: number;
  className?: string;
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 64 64"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
  >
    <defs>
      <linearGradient
        id="cb-grad"
        x1="0"
        y1="0"
        x2="64"
        y2="64"
        gradientUnits="userSpaceOnUse"
      >
        <stop offset="0%" stopColor="#22D3EE" />
        <stop offset="50%" stopColor="#818CF8" />
        <stop offset="100%" stopColor="#A855F7" />
      </linearGradient>
      <linearGradient
        id="cb-inner"
        x1="16"
        y1="16"
        x2="48"
        y2="48"
        gradientUnits="userSpaceOnUse"
      >
        <stop offset="0%" stopColor="#22D3EE" />
        <stop offset="100%" stopColor="#A855F7" />
      </linearGradient>
      <filter id="cb-glow">
        <feGaussianBlur stdDeviation="2" result="blur" />
        <feMerge>
          <feMergeNode in="blur" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
    </defs>

    {/* Outer shield shape */}
    <path
      d="M32 4 L56 16 V34 C56 46 46 56 32 60 C18 56 8 46 8 34 V16 L32 4Z"
      stroke="url(#cb-grad)"
      strokeWidth="2.5"
      strokeLinejoin="round"
      fill="none"
      filter="url(#cb-glow)"
    />

    {/* Inner shield fill (subtle) */}
    <path
      d="M32 8 L52 18 V34 C52 44 43 52 32 56 C21 52 12 44 12 34 V18 L32 8Z"
      fill="url(#cb-grad)"
      opacity="0.10"
    />

    {/* Top block */}
    <rect
      x="25"
      y="17"
      width="14"
      height="9"
      rx="2"
      stroke="url(#cb-inner)"
      strokeWidth="1.8"
      fill="rgba(34,211,238,0.08)"
    />
    {/* Bottom-left block */}
    <rect
      x="16"
      y="31"
      width="14"
      height="9"
      rx="2"
      stroke="url(#cb-inner)"
      strokeWidth="1.8"
      fill="rgba(129,140,248,0.08)"
    />
    {/* Bottom-right block */}
    <rect
      x="34"
      y="31"
      width="14"
      height="9"
      rx="2"
      stroke="url(#cb-inner)"
      strokeWidth="1.8"
      fill="rgba(168,85,247,0.08)"
    />

    {/* Chain links connecting blocks */}
    <path
      d="M29 26 L23 31"
      stroke="url(#cb-inner)"
      strokeWidth="1.8"
      strokeLinecap="round"
    />
    <path
      d="M35 26 L41 31"
      stroke="url(#cb-inner)"
      strokeWidth="1.8"
      strokeLinecap="round"
    />
    <path
      d="M30 35.5 L34 35.5"
      stroke="url(#cb-inner)"
      strokeWidth="1.8"
      strokeLinecap="round"
    />

    {/* Chain node dots */}
    <circle cx="32" cy="21.5" r="1.8" fill="#22D3EE" />
    <circle cx="23" cy="35.5" r="1.8" fill="#818CF8" />
    <circle cx="41" cy="35.5" r="1.8" fill="#A855F7" />

    {/* Security check mark (subtle) */}
    <path
      d="M28 44 L31 47 L37 41"
      stroke="url(#cb-inner)"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      opacity="0.7"
    />

    {/* Pulse ring at center */}
    <circle
      cx="32"
      cy="32"
      r="3"
      fill="none"
      stroke="url(#cb-inner)"
      strokeWidth="1"
      opacity="0.5"
    >
      <animate
        attributeName="r"
        values="3;6;3"
        dur="2.5s"
        repeatCount="indefinite"
      />
      <animate
        attributeName="opacity"
        values="0.5;0.1;0.5"
        dur="2.5s"
        repeatCount="indefinite"
      />
    </circle>
  </svg>
);

export default CuraBlockLogo;
// Backward-compat alias
export { CuraBlockLogo as NeuroShieldLogo };
