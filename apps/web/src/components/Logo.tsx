import { cn } from "@/lib/utils";

interface LogoProps {
  className?: string;
  /** Travessa na cor da marca */
  accent?: boolean;
}

export function Logo({ className, accent = true }: LogoProps) {
  return (
    <svg
      viewBox="0 0 120 120"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("h-10 w-auto", className)}
      aria-label="Archtec"
    >
      <path d="M60 22 98 92H80L60 54 40 92H22Z" fill="currentColor" />
      <rect x="44" y="68" width="32" height="8" className={accent ? "fill-brand" : "fill-current"} />
    </svg>
  );
}
