// Subsumio brand lockup — scales of justice in a royal-blue app tile + the
// "Subsum•io" wordmark (the blue dot is the domain dot of subsum.io). A serious,
// legal-professional palette, distinct from the violet Sigmabrain platform mark.

import { Scale } from "lucide-react";

export function SubsumioMark({ size = 36 }: { size?: number }) {
  return (
    <span className="relative inline-flex shrink-0" style={{ width: size, height: size }}>
      {/* soft outer halo */}
      <span
        aria-hidden
        className="absolute -inset-1 rounded-[34%] blur-md opacity-50"
        style={{ background: "radial-gradient(circle, rgba(37,99,235,0.55), transparent 70%)" }}
      />
      <span
        className="relative inline-flex items-center justify-center rounded-[30%] ring-1 ring-white/15 shadow-lg shadow-blue-950/50"
        style={{
          width: size,
          height: size,
          background: "linear-gradient(150deg, #1e3a8a 0%, #1d4ed8 52%, #0ea5e9 100%)",
        }}
      >
        <Scale size={Math.round(size * 0.56)} className="text-white" strokeWidth={2} aria-hidden />
      </span>
    </span>
  );
}

export function SubsumioLogo({
  size = 34,
  subtitle = "BY SIGMACODE",
  className = "",
}: {
  size?: number;
  subtitle?: string;
  className?: string;
}) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <SubsumioMark size={size} />
      <span className="flex flex-col leading-none">
        <span className="font-display text-lg font-extrabold tracking-tight text-[#e8e8f0]">
          Subsum<span className="text-[#3b82f6]">•</span>io
        </span>
        {subtitle && (
          <span className="text-[10px] font-semibold tracking-[0.18em] text-[#3b82f6] mt-1">{subtitle}</span>
        )}
      </span>
    </span>
  );
}
