"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { cva, type VariantProps } from "class-variance-authority";
import { motion } from "framer-motion";
import { Loader2 } from "lucide-react";
import React from "react";

// 定義加載動畫變體
const loadingVariants = cva("animate-spin relative", {
  variants: {
    size: {
      default: "h-4 w-4",
      sm: "h-3 w-3",
      lg: "h-5 w-5",
    },
    variant: {
      default: "text-white",
      primary: "text-primary-foreground",
      secondary: "text-secondary-foreground",
      outline: "text-primary",
      ghost: "text-primary",
    },
  },
  defaultVariants: {
    size: "default",
    variant: "default",
  },
});

export interface LoadingButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof loadingVariants> {
  isLoading?: boolean;
  loadingText?: string;
  loadingIcon?: React.ReactNode;
  children: React.ReactNode;
  buttonProps?: React.ComponentProps<typeof Button>;
}

// 透明加載按鈕組件
const LoadingButton = React.forwardRef<HTMLButtonElement, LoadingButtonProps>(
  (
    {
      className,
      size,
      variant,
      isLoading,
      loadingText,
      loadingIcon,
      children,
      buttonProps,
      ...props
    },
    ref,
  ) => {
    return (
      <Button
        ref={ref}
        disabled={isLoading || props.disabled}
        {...buttonProps}
        {...props}
        className={cn("relative", className)}
      >
        {isLoading && (
          <motion.span
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 flex items-center justify-center bg-transparent backdrop-blur-[1px] rounded-md z-10"
          >
            {loadingIcon ? (
              loadingIcon
            ) : (
              <Loader2 className={cn(loadingVariants({ size, variant }))} />
            )}
          </motion.span>
        )}

        <span className={cn("flex items-center justify-center gap-2")}>
          {children}
        </span>

        {isLoading && loadingText && (
          <span className="sr-only">{loadingText}</span>
        )}
      </Button>
    );
  },
);

LoadingButton.displayName = "LoadingButton";

export { LoadingButton };
