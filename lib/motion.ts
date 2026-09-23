// lib/motion.ts — the ONLY spring values allowed in this codebase.
//
// uiSpring: critically damped default for all enter/exit/chrome motion.
// momentumSpring: ONLY for momentum arrivals (live bid-feed bursts).
//
// Reduced-motion users get an opacity cross-fade (<=200ms, no overshoot):
// components branch on useReducedMotion() and Chrome wraps the tree in
// <MotionConfig reducedMotion="user"> as a library-level kill-switch for
// springs/slides, backed by the CSS guard in globals.css.
import { useReducedMotion } from "motion/react";
import type { Transition } from "motion/react";

export const uiSpring: Transition = {
  type: "spring",
  bounce: 0,
  duration: 0.35,
} as const;

export const momentumSpring: Transition = {
  type: "spring",
  bounce: 0.2,
  duration: 0.35,
} as const;

// Opacity-only cross-fade for prefers-reduced-motion. Not a spring.
export const fadeTransition: Transition = {
  duration: 0.15,
  ease: "easeOut",
} as const;

type EnterProps = {
  initial: { opacity: number; y?: number };
  animate: { opacity: number; y?: number };
  transition: Transition;
};

/**
 * Enter-animation props: slide+fade with the given spring normally,
 * opacity-only cross-fade when the user prefers reduced motion.
 * Pass the result straight into a motion.* element.
 */
export function useEnter(
  spring: Transition = uiSpring,
  distance = 12,
): EnterProps {
  const reduce = useReducedMotion();
  if (reduce) {
    return {
      initial: { opacity: 0 },
      animate: { opacity: 1 },
      transition: fadeTransition,
    };
  }
  return {
    initial: { opacity: 0, y: distance },
    animate: { opacity: 1, y: 0 },
    transition: spring,
  };
}
