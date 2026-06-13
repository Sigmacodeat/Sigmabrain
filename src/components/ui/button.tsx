"use client";

import { cva, type VariantProps } from "class-variance-authority";
import { forwardRef } from "react";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 font-medium rounded-lg cursor-pointer select-none disabled:opacity-40 disabled:pointer-events-none",
  {
    variants: {
      variant: {
        primary:
          "bg-violet-600 text-white hover:bg-violet-500 shadow-lg shadow-violet-900/30",
        secondary:
          "bg-transparent border border-[#1e1e3a] text-[#8888aa] hover:border-[#3a3a6a] hover:text-[#e8e8f0] hover:bg-[#12122a]",
        ghost:
          "bg-transparent text-[#8888aa] hover:text-[#e8e8f0] hover:bg-[#12122a]",
        danger:
          "bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 hover:border-red-500/40",
        success:
          "bg-emerald-600 text-white hover:bg-emerald-500 shadow-lg shadow-emerald-900/30",
        glow:
          "bg-violet-600 text-white hover:bg-violet-500 shadow-lg shadow-violet-900/40 ring-1 ring-violet-500/30",
        outline:
          "border border-violet-500/30 text-violet-400 hover:bg-violet-500/10 hover:border-violet-500/50",
      },
      size: {
        sm: "text-xs px-3 py-1.5",
        md: "text-sm px-4 py-2",
        lg: "text-sm px-6 py-3",
        xl: "text-base px-8 py-4",
        icon: "p-2",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  loading?: boolean;
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, loading, children, disabled, ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(buttonVariants({ variant, size }), className)}
        disabled={disabled || loading}
        {...props}
      >
        {loading && (
          <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
        )}
        {children}
      </button>
    );
  }
);

Button.displayName = "Button";

export { Button, buttonVariants };
