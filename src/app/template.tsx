"use client";

// Global route transition. template.tsx re-mounts on every navigation, so this
// gives a smooth cross-page fade. OPACITY ONLY — a transform here would make
// position:fixed children (the parallax background) and sticky nav misbehave.
// Respects prefers-reduced-motion via MotionConfig.

import { motion, MotionConfig } from "framer-motion";

export default function Template({ children }: { children: React.ReactNode }) {
  return (
    <MotionConfig reducedMotion="user">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3, ease: "easeOut" }}
      >
        {children}
      </motion.div>
    </MotionConfig>
  );
}
