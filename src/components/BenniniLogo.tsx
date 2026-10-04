import logoAsset from "@/assets/bennini-etpi-logo.png.asset.json";
import { useState } from "react";

interface BenniniLogoProps {
  className?: string;
  variant?: "dark" | "light" | "colored";
  size?: "sm" | "md" | "lg" | "xl";
  showText?: boolean;
}

export function BenniniLogo({
  className = "",
  variant = "colored",
  size = "md",
  showText = true,
}: BenniniLogoProps) {
  const [imageError, setImageError] = useState(false);

  const sizeClasses = {
    sm: "h-8",
    md: "h-12",
    lg: "h-16",
    xl: "h-24",
  }[size];

  if (!imageError && logoAsset?.url) {
    return (
      <div className={`inline-flex items-center gap-2 ${className}`}>
        <img
          src={logoAsset.url}
          alt="BENNINI ETPI"
          onError={() => setImageError(true)}
          className={`${sizeClasses} w-auto object-contain transition-transform`}
        />
      </div>
    );
  }

  // High-fidelity fallback SVG representing the BENNINI ETPI emblem & highway
  return (
    <div className={`inline-flex items-center gap-3 ${className}`}>
      <div className="relative flex shrink-0 items-center justify-center">
        <svg
          viewBox="0 0 120 100"
          className={`${sizeClasses} w-auto drop-shadow-sm`}
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Building silhouettes in deep blue */}
          <rect x="25" y="32" width="10" height="42" fill="#083c7a" rx="1.5" />
          <rect x="38" y="20" width="10" height="54" fill="#0555a8" rx="1.5" />
          <rect x="51" y="24" width="9" height="50" fill="#f5b41e" rx="1.5" />
          {/* Stylized 'B' curve with Highway road */}
          <path d="M 20 80 Q 55 58 102 62 Q 78 40 45 42 Q 28 44 20 80 Z" fill="#083c7a" />
          {/* Yellow Road Arc */}
          <path d="M 18 82 Q 55 60 105 64 Q 60 55 18 82 Z" fill="#f5b41e" />
          {/* Highway Dashed Lines */}
          <path
            d="M 32 76 Q 58 64 88 64"
            stroke="#ffffff"
            strokeWidth="2.5"
            strokeDasharray="4 4"
          />
        </svg>
      </div>
      {showText && (
        <div className="text-right leading-tight">
          <div
            className={`font-black tracking-tight ${
              variant === "dark" || variant === "colored" ? "text-primary" : "text-white"
            } ${size === "sm" ? "text-base" : size === "lg" ? "text-2xl" : "text-xl"}`}
          >
            BENNINI <span className="text-brand-yellow">ETPI</span>
          </div>
          <div
            className={`text-[9px] font-semibold tracking-wider ${
              variant === "light" ? "text-slate-300" : "text-muted-foreground"
            }`}
          >
            TRAVAUX PUBLICS & INDUSTRIELS
          </div>
        </div>
      )}
    </div>
  );
}
