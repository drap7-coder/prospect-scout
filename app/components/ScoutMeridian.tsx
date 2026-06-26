"use client";

/**
 * The Scout Meridian — Prospect Scout's visual identity.
 *
 * A single vertical line sweeps a field of dormant nodes. One node holds
 * signal. When the meridian crosses it, the connection resolves — intelligence
 * surfacing the prospect worth calling.
 */

const FIELD_NODES: { x: number; y: number; o: number }[] = [
  { x: 48, y: 72, o: 0.1 },
  { x: 92, y: 118, o: 0.07 },
  { x: 156, y: 54, o: 0.09 },
  { x: 204, y: 168, o: 0.06 },
  { x: 72, y: 248, o: 0.08 },
  { x: 128, y: 312, o: 0.05 },
  { x: 188, y: 284, o: 0.07 },
  { x: 248, y: 96, o: 0.06 },
  { x: 312, y: 188, o: 0.08 },
  { x: 336, y: 340, o: 0.05 },
  { x: 88, y: 392, o: 0.06 },
  { x: 172, y: 428, o: 0.07 },
  { x: 268, y: 468, o: 0.05 },
  { x: 348, y: 420, o: 0.06 },
  { x: 52, y: 512, o: 0.05 },
  { x: 220, y: 532, o: 0.07 },
  { x: 296, y: 548, o: 0.05 },
];

/** The resolved signal — the prospect the meridian finds. */
const SIGNAL = { x: 268, y: 220 };

export function MeridianMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 16 16"
      className={className}
      aria-hidden
      fill="none"
    >
      <line
        x1="8"
        y1="2"
        x2="8"
        y2="14"
        stroke="currentColor"
        strokeWidth="1.25"
        strokeLinecap="round"
        className="text-accent/70"
      />
      <circle cx="8" cy="8" r="2.25" className="fill-accent-cyan" />
    </svg>
  );
}

export function ScoutMeridian({ className }: { className?: string }) {
  return (
    <div
      className={`scout-meridian relative select-none ${className ?? ""}`}
      aria-hidden
    >
      <svg
        viewBox="0 0 400 580"
        className="h-full w-full"
        preserveAspectRatio="xMidYMid meet"
      >
        <defs>
          <linearGradient id="meridian-gradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--accent-cyan)" stopOpacity="0" />
            <stop offset="18%" stopColor="var(--accent-cyan)" stopOpacity="0.85" />
            <stop offset="82%" stopColor="var(--accent)" stopOpacity="0.85" />
            <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
          </linearGradient>
          <radialGradient id="signal-glow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="var(--accent-cyan)" stopOpacity="0.55" />
            <stop offset="100%" stopColor="var(--accent-cyan)" stopOpacity="0" />
          </radialGradient>
          <filter id="signal-blur" x="-100%" y="-100%" width="300%" height="300%">
            <feGaussianBlur stdDeviation="6" />
          </filter>
        </defs>

        {/* Field nodes — organizational noise */}
        {FIELD_NODES.map((n, i) => (
          <circle
            key={i}
            cx={n.x}
            cy={n.y}
            r={1.75}
            fill="var(--foreground)"
            opacity={n.o}
          />
        ))}

        {/* Signal node — the prospect */}
        <circle
          cx={SIGNAL.x}
          cy={SIGNAL.y}
          r="28"
          fill="url(#signal-glow)"
          filter="url(#signal-blur)"
          className="scout-signal-halo"
        />
        <circle
          cx={SIGNAL.x}
          cy={SIGNAL.y}
          r="3.25"
          className="scout-signal-core fill-accent-cyan"
        />

        {/* Connection thread — vertical trace when meridian resolves signal */}
        <line
          x1={SIGNAL.x}
          y1={SIGNAL.y - 48}
          x2={SIGNAL.x}
          y2={SIGNAL.y}
          stroke="var(--accent-cyan)"
          strokeWidth="0.75"
          className="scout-signal-thread"
          pathLength={100}
        />

        {/* The meridian — intelligence in motion */}
        <g className="scout-meridian-sweep">
          <line
            x1="0"
            y1="48"
            x2="0"
            y2="532"
            stroke="url(#meridian-gradient)"
            strokeWidth="1"
            className="scout-meridian-line"
          />
        </g>
      </svg>

      {/* Edge vignette — cinematic frame */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_0%,var(--background)_78%)]" />
    </div>
  );
}
