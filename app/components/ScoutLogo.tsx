import Image from "next/image";

const LOGO_SRC = "/prospect-scout-logo.png";

export function ScoutLogo({
  size = 32,
  className = "",
  priority = false,
}: {
  size?: number;
  className?: string;
  priority?: boolean;
}) {
  return (
    <Image
      src={LOGO_SRC}
      alt=""
      width={size}
      height={size}
      priority={priority}
      className={`shrink-0 rounded-full object-cover ${className}`}
      aria-hidden
    />
  );
}

/** Logo + wordmark lockup for headers. */
export function ScoutBrand({
  size = 32,
  showSubtitle = false,
  className = "",
}: {
  size?: number;
  showSubtitle?: boolean;
  className?: string;
}) {
  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <ScoutLogo size={size} />
      <div className="min-w-0">
        <span className="block text-[0.9375rem] font-semibold leading-tight tracking-[-0.02em] text-foreground">
          Prospect Scout
        </span>
        {showSubtitle ? (
          <span className="label-mono mt-0.5 block normal-case tracking-normal text-muted-2">
            Opportunity intelligence
          </span>
        ) : null}
      </div>
    </div>
  );
}
