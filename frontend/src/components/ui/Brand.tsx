export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <span className="brand">
      <svg width="30" height="30" viewBox="0 0 32 32" fill="none" aria-hidden="true">
        <path
          d="M16 8C8-1 0 11 8 17L16 24C24 33 32 21 24 15L16 8Z"
          stroke="currentColor"
          strokeWidth="4.5"
        />
        <path d="M10 21L22 11" stroke="currentColor" strokeWidth="4.5" />
      </svg>
      {!compact && (
        <span>
          brightloop<span className="brand-period">.</span>
        </span>
      )}
    </span>
  );
}
