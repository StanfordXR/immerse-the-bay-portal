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
    <Link href={href} className="flex items-center gap-2.5">
      <Image
        src="/bunny.png"
        alt=""
        width={30}
        height={30}
        className="h-[30px] w-[30px] object-contain"
        priority
      />
      <span className="font-brand text-brand-gradient text-[15px] tracking-wide">
        IMMERSE THE BAY
        {suffix && <span className="text-cyan"> {suffix}</span>}
      </span>
    </Link>
  );
}
