"use client";

// Central motion system for all marketing pages.
// Eliminates copy-paste animation patterns across every page component.
// State-of-the-art: staggerChildren, spring physics, reduced-motion fallback,
// GPU-optimized transforms, shared layout animations.

import { motion, useInView, useReducedMotion, Variants } from "framer-motion";
import { createContext, ReactNode, useContext, useEffect, useMemo, useRef, useState } from "react";

// ---------------------------------------------------------------------------
// Viewport presets
// ---------------------------------------------------------------------------

export const VIEWPORT = {
  gentle: { once: true, margin: "0px 0px 80px 0px", amount: 0.12 },
  tight:  { once: true, margin: "-60px" },
  hero:   { once: true, margin: "0px" },
} as const;

// ---------------------------------------------------------------------------
// Easing curves (modern, non-linear)
// ---------------------------------------------------------------------------

export const EASE = {
  // Smooth deceleration — the default for scroll-reveals
  out:      [0.22, 1, 0.36, 1] as const,
  // Snappy spring-like
  spring:   [0.21, 0.5, 0.27, 1] as const,
  // Dramatic entrance
  dramatic: [0.16, 1, 0.3, 1] as const,
} as const;

// ---------------------------------------------------------------------------
// Base variants factory (reduced-motion aware)
// ---------------------------------------------------------------------------

function makeVariants(opts: {
  y?: number;
  x?: number;
  scale?: number;
  duration?: number;
  ease?: readonly [number, number, number, number];
  delay?: number;
}): Variants {
  const { y = 24, x = 0, scale = 1, duration = 0.5, ease = EASE.out, delay = 0 } = opts;
  return {
    hidden: { opacity: 0, y: y || 0, x: x || 0, scale },
    visible: {
      opacity: 1,
      y: 0,
      x: 0,
      scale: 1,
      transition: { duration, ease, delay },
    },
  };
}

// ---------------------------------------------------------------------------
// Pre-built reveal presets (use these instead of inline copy-paste)
// ---------------------------------------------------------------------------

export const REVEAL = {
  /** Default scroll-reveal: fade up 24px, 0.5s */
  up:    (delay = 0) => makeVariants({ y: 24, duration: 0.5, delay }),
  /** Tighter fade up: 16px, 0.45s */
  upSm:  (delay = 0) => makeVariants({ y: 16, duration: 0.45, delay }),
  /** Dramatic fade up: 32px, 0.6s */
  upLg:  (delay = 0) => makeVariants({ y: 32, duration: 0.6, ease: EASE.dramatic, delay }),
  /** Fade from left: -20px x, 0.45s */
  left:  (delay = 0) => makeVariants({ x: -20, duration: 0.45, delay }),
  /** Fade from right: +20px x, 0.45s */
  right: (delay = 0) => makeVariants({ x: 20,  duration: 0.45, delay }),
  /** Scale-in: 0.96 -> 1, 0.5s */
  scale: (delay = 0) => makeVariants({ scale: 0.96, duration: 0.5, delay }),
  /** Subtle: 8px up, 0.4s — good for dense grids */
  subtle:(delay = 0) => makeVariants({ y: 8,  duration: 0.4, delay }),
} as const;

// ---------------------------------------------------------------------------
// Stagger container (replaces manual delay math everywhere)
// ---------------------------------------------------------------------------

interface StaggerContainerProps {
  children: ReactNode;
  className?: string;
  stagger?: number;      // delay between children (default 0.08)
  duration?: number;     // base duration (default 0.45)
  viewport?: { once?: boolean; margin?: string; amount?: number };
  y?: number;            // initial y offset
  as?: "div" | "section" | "ul" | "ol";
}

export function StaggerContainer({
  children,
  className = "",
  stagger = 0.08,
  duration = 0.45,
  viewport = VIEWPORT.gentle,
  y = 20,
  as: Tag = "div",
}: StaggerContainerProps) {
  const reduce = useReducedMotion();

  const container: Variants = useMemo(() => ({
    hidden: {},
    visible: {
      transition: { staggerChildren: reduce ? 0 : stagger },
    },
  }), [reduce, stagger]);

  const child: Variants = useMemo(() => ({
    hidden: { opacity: 0, y: reduce ? 0 : y },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration, ease: EASE.out },
    },
  }), [reduce, y, duration]);

  return (
    <motion.div
      initial="hidden"
      whileInView="visible"
      viewport={viewport}
      variants={container}
      className={className}
    >
      <StaggerContext.Provider value={child}>
        {Tag === "div" ? (
          <div>{children}</div>
        ) : Tag === "section" ? (
          <section>{children}</section>
        ) : Tag === "ul" ? (
          <ul>{children}</ul>
        ) : (
          <ol>{children}</ol>
        )}
      </StaggerContext.Provider>
    </motion.div>
  );
}

const StaggerContext = createContext<Variants | undefined>(undefined);

/** Wrap any element inside a StaggerContainer to auto-inherit stagger timing. */
export function StaggerItem({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  const variants = useContext(StaggerContext);
  if (!variants) {
    // Fallback: no parent StaggerContainer → just render
    return <div className={className}>{children}</div>;
  }
  return (
    <motion.div variants={variants} className={className}>
      {children}
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Reveal wrapper (single element scroll-reveal)
// ---------------------------------------------------------------------------

interface RevealProps {
  children: ReactNode;
  variant?: keyof typeof REVEAL;
  delay?: number;
  className?: string;
  viewport?: { once?: boolean; margin?: string; amount?: number };
  as?: "div" | "section" | "article";
}

export function Reveal({
  children,
  variant = "up",
  delay = 0,
  className = "",
  viewport = VIEWPORT.gentle,
  as: Tag = "div",
}: RevealProps) {
  const variants = REVEAL[variant](delay);
  const MotionTag = motion[Tag];
  return (
    <MotionTag
      initial="hidden"
      whileInView="visible"
      viewport={viewport}
      variants={variants}
      className={className}
    >
      {children}
    </MotionTag>
  );
}

// ---------------------------------------------------------------------------
// Hero entrance wrapper (animate on mount, not scroll)
// ---------------------------------------------------------------------------

interface HeroRevealProps {
  children: ReactNode;
  delay?: number;
  className?: string;
}

export function HeroReveal({ children, delay = 0, className = "" }: HeroRevealProps) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      initial={{ opacity: 0, y: reduce ? 0 : 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.55, ease: EASE.out, delay }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Animated counter (GPU-optimized, reduced-motion aware)
// ---------------------------------------------------------------------------

export function AnimatedCounter({
  to,
  decimals = 0,
  prefix = "",
  suffix = "",
  duration = 1200,
  className = "",
}: {
  to: number;
  decimals?: number;
  prefix?: string;
  suffix?: string;
  duration?: number;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "-40px" });
  const reduce = useReducedMotion();
  const [val, setVal] = useState(0);

  useEffect(() => {
    if (!inView) return;
    if (reduce) {
      setVal(to);
      return;
    }
    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - t, 4); // easeOutQuart — snappier than cubic
      setVal(to * eased);
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [inView, to, reduce, duration]);

  return (
    <span ref={ref} className={className}>
      {prefix}{val.toFixed(decimals)}{suffix}
    </span>
  );
}
