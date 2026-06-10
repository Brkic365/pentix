/**
 * The Pentix mark: a pentagon (penta = 5) wrapped around the base unit of the
 * whole economy — 5 pushups per goal.
 */
export function PentixMark({ size = 36 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      aria-hidden
      className="shrink-0"
    >
      <polygon
        points="50,4 96,38 78,92 22,92 4,38"
        fill="#c8f31d"
        stroke="#07090d"
        strokeWidth="4"
      />
      <text
        x="50"
        y="70"
        textAnchor="middle"
        fontFamily="var(--font-anton), sans-serif"
        fontSize="56"
        fill="#07090d"
      >
        5
      </text>
    </svg>
  );
}

export function PentixLogo({ size = 32 }: { size?: number }) {
  return (
    <span className="inline-flex items-center gap-2">
      <PentixMark size={size} />
      <span
        className="font-display text-ink tracking-wide"
        style={{ fontSize: size * 0.78 }}
      >
        PENTIX
      </span>
    </span>
  );
}
