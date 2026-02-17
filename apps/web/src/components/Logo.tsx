import { cn } from "@/lib/utils";

interface LogoProps {
  className?: string;    
  bgFill?: string;      
}

export function Logo({ className, bgFill = "fill-slate-950" }: LogoProps) {
  return (
    <svg
      viewBox="0 0 120 120"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("w-auto h-10", className)} 
      aria-label="Architect Logo"
    >

      <path 
        d="M 60 25 L 95 85 L 80 85 L 60 50 L 40 85 L 25 85 Z" 
        fill="currentColor" 
      />
      

      <rect 
        x="47" 
        y="65" 
        width="26" 
        height="8" 
        className={bgFill} 
      />
    </svg>
  );
}