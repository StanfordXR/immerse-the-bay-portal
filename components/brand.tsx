import Image from "next/image";
import Link from "next/link";

/**
 * The brand lockup: Stanford XR bunny + IMMERSE THE BAY wordmark.
 * Per brand direction, the bunny appears only with the wordmark beside it;
 * standalone contexts use the square IMMERSE / THE BAY mark instead.
 */
export function Brand({
  suffix,
  href = "/",
}: {
  suffix?: string;
  href?: string;
}) {
  return (
    <Link href={href} className="flex items-center gap-3">
      <Image
        src="/bunny.png"
        alt=""
        width={40}
        height={40}
        className="h-10 w-10 object-contain"
        priority
      />
      <span className="font-brand text-brand-gradient text-[18px] tracking-wide">
        IMMERSE THE BAY
        {suffix && <span className="text-cyan"> {suffix}</span>}
      </span>
    </Link>
  );
}
