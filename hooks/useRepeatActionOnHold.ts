"use client";

import { useCallback, useEffect, useRef } from "react";

interface UseRepeatActionOnHoldOptions {
  callback: () => void;
  delay?: number;
  interval?: number;
  disabled?: boolean;
}

const DEFAULT_DELAY_MS = 400;
const DEFAULT_INTERVAL_MS = 100;

export function useRepeatActionOnHold({
  callback,
  delay = DEFAULT_DELAY_MS,
  interval = DEFAULT_INTERVAL_MS,
  disabled = false,
}: UseRepeatActionOnHoldOptions) {
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  // Store callback and disabled state in refs to prevent stale closures in timers
  const callbackRef = useRef(callback);
  const disabledRef = useRef(disabled);

  // Update refs if dependencies change
  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  useEffect(() => {
    disabledRef.current = disabled;
  }, [disabled]);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const startTimer = useCallback(
    (isInitialCall: boolean) => {
      if (disabledRef.current) {
        stopTimer();
        return;
      }

      // Call the callback immediately on the first trigger (mousedown)
      if (isInitialCall) {
        callbackRef.current();
      }

      // Schedule the next call
      timerRef.current = setTimeout(
        () => {
          if (disabledRef.current) {
            stopTimer();
            return;
          }
          // Call the callback for subsequent triggers
          callbackRef.current();
          // Schedule the next repeat
          startTimer(false); // Not the initial call anymore
        },
        isInitialCall ? delay : interval,
      ); // Use delay for first repeat, then interval
    },
    [delay, interval, stopTimer],
  );

  const handleMouseDown = useCallback(() => {
    stopTimer(); // Clear any existing timer
    if (!disabledRef.current) {
      startTimer(true); // Start the process, indicating it's the initial call
    }
  }, [startTimer, stopTimer]);

  const handleMouseUpOrLeave = useCallback(() => {
    stopTimer();
  }, [stopTimer]);

  return {
    onMouseDown: handleMouseDown,
    onMouseUp: handleMouseUpOrLeave,
    onMouseLeave: handleMouseUpOrLeave,
  };
}
