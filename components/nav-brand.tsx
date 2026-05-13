import Link from "next/link";

/**
 * Nav brand mark. Wordmark with cyan underline reveal on hover.
 */
export function NavBrand() {
  return (
    <Link
      href="/"
      aria-label="Selbo home"
      className="group relative text-2xl font-bold tracking-tight text-foreground"
    >
      Selbo
      <span
        aria-hidden
        className="pointer-events-none absolute -bottom-1 left-0 h-px w-full origin-left scale-x-0 bg-[var(--neon-cyan)] transition-transform duration-300 ease-out group-hover:scale-x-100"
      />
    </Link>
  );
}
