import { useId } from "react";

export function LogoMark({ className = "size-10" }: { className?: string }) {
  // Unique id: a hidden (display:none) sibling SVG with the same id would break the gradient.
  const gid = useId();
  return (
    <svg viewBox="0 0 512 512" className={className} aria-hidden="true">
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#E0183A" />
          <stop offset="1" stopColor="#9C0B24" />
        </linearGradient>
      </defs>
      <rect width="512" height="512" rx="112" fill={`url(#${gid})`} />
      <path
        d="M206 160v192c0 12 13 19 23 13l158-96c9-6 9-20 0-26L229 147c-10-6-23 1-23 13Z"
        fill="#fff"
      />
    </svg>
  );
}

/** Mark + wordmark. The wordmark is Latin, so it is pinned LTR inside the RTL page. */
export function Logo({ className = "" }: { className?: string }) {
  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <LogoMark className="size-10 shrink-0" />
      <div className="leading-tight">
        <div dir="ltr" className="text-start text-lg font-extrabold tracking-tight">
          Dragon<span className="text-crimson-text">Vision</span>
        </div>
        <div className="text-xs text-muted">منصة الفريق</div>
      </div>
    </div>
  );
}
