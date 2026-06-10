/**
 * The Pentix mark: a pentagon (penta = 5) around the base unit of the whole
 * economy — 5 pushups per goal.
 */
export function PentixMark({
  size = 28,
  className = "",
}: {
  size?: number;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      aria-hidden
      className={`shrink-0 ${className}`}
    >
      <polygon points="50,4 96,38 78,92 22,92 4,38" fill="var(--primary, #15803d)" />
      <text
        x="50"
        y="72"
        textAnchor="middle"
        fontFamily="var(--font-inter), system-ui, sans-serif"
        fontWeight="700"
        fontSize="52"
        fill="var(--primary-fg, #ffffff)"
      >
        5
      </text>
    </svg>
  );
}

export function PentixLogo({ size = 26 }: { size?: number }) {
  return (
    <span className="inline-flex items-center gap-2">
      <PentixMark size={size} />
      <span
        className="font-semibold tracking-tight text-ink"
        style={{ fontSize: size * 0.72 }}
      >
        Pentix
      </span>
    </span>
  );
}
