"use client";

// Animated FAQ accordion — replaces the native <details> with a
// Framer-Motion AnimatePresence height animation for agency-level polish.
// Single-open: opening one item closes the previous one smoothly.

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown } from "lucide-react";

export function AnimatedFaqList({
  items,
  tone = "dark",
}: {
  items: readonly { q: string; a: string }[];
  tone?: "dark" | "light";
}) {
  const [open, setOpen] = useState<number | null>(null);
  const light = tone === "light";

  return (
    <div className="max-w-3xl mx-auto space-y-3">
      {items.map((item, i) => {
        const isOpen = open === i;
        return (
          <motion.div
            key={item.q}
            initial={{ opacity: 0, y: 14 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-40px" }}
            transition={{ duration: 0.35, delay: i * 0.055 }}
          >
            <div
              className={`rounded-xl overflow-hidden transition-all duration-200 ${
                light
                  ? isOpen
                    ? "border border-[var(--signal-blue)]/30 shadow-md shadow-blue-900/5"
                    : "border border-[var(--color-light-border)]"
                  : isOpen
                  ? "border border-[#3a3a6a]"
                  : "border border-[#1e1e3a]"
              }`}
              style={{
                background: light ? "var(--color-light-surface)" : "#0d0d1a",
              }}
            >
              <button
                onClick={() => setOpen(isOpen ? null : i)}
                className="w-full flex items-center justify-between px-5 py-4 text-sm font-medium text-left gap-4"
                aria-expanded={isOpen}
                style={{ color: light ? "var(--color-light-text)" : "#e8e8f0" }}
              >
                <span>{item.q}</span>
                <motion.span
                  animate={{ rotate: isOpen ? 180 : 0 }}
                  transition={{ duration: 0.25, ease: "easeInOut" }}
                  className="shrink-0"
                >
                  <ChevronDown
                    size={15}
                    style={{ color: light ? "var(--color-light-text-muted)" : "#7878a0" }}
                  />
                </motion.span>
              </button>

              <AnimatePresence initial={false}>
                {isOpen && (
                  <motion.div
                    key="body"
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.28, ease: [0.25, 0.1, 0.25, 1] }}
                    style={{ overflow: "hidden" }}
                  >
                    <p
                      className="px-5 pb-5 text-sm leading-relaxed"
                      style={{ color: light ? "var(--color-light-text-muted)" : "#8888aa" }}
                    >
                      {item.a}
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}
