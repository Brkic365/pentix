/* eslint-disable @next/next/no-img-element */

export function TeamFlag({
  flagUrl,
  name,
  size = 24,
}: {
  flagUrl?: string | null;
  name: string;
  size?: number;
}) {
  if (!flagUrl) {
    return (
      <span
        className="inline-flex items-center justify-center rounded-sm border border-line bg-card-subtle text-[10px] font-semibold text-muted"
        style={{ width: size * 1.33, height: size }}
        aria-hidden
      >
        ?
      </span>
    );
  }
  return (
    <img
      src={flagUrl}
      alt={`Zastava: ${name}`}
      width={size * 1.33}
      height={size}
      loading="lazy"
      className="rounded-sm object-cover shadow"
      style={{ width: size * 1.33, height: size }}
    />
  );
}
