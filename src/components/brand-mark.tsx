import Link from "next/link";
import Image from "next/image";

// Small clickable logo mark used in every page header. Routes home on click,
// matching the convention every web app since the 90s. Stays subtle (40px
// default) so it doesn't compete with page-specific titles + actions.
//
// The homepage uses a bigger 72px instance inline (since it IS home, no
// link wrap needed and it acts as a hero element). Every other page uses
// THIS component for consistency.

export function BrandMark({ size = 40 }: { size?: number }) {
  return (
    <Link
      href="/"
      className="shrink-0"
      aria-label="Thinking Outside the Box — home"
      title="Home"
    >
      <Image
        src="/logo.png"
        alt=""
        width={size}
        height={size}
        priority
      />
    </Link>
  );
}
