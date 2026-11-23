import React, { useEffect } from 'react';
import { motion, useReducedMotion, type Transition } from 'motion/react';

export type MotionModalVariant = 'sheet' | 'fullscreen' | 'drawer-right';

export const IOS27_MODAL_SPRING: Transition = {
  type: 'spring',
  stiffness: 370,
  damping: 33,
  mass: 0.88,
};

export const IOS27_BACKDROP_TRANSITION: Transition = {
  duration: 0.2,
  ease: [0.22, 1, 0.36, 1],
};

interface MotionModalProps {
  variant?: MotionModalVariant;
  overlayClassName?: string;
  panelClassName?: string;
  ariaLabel?: string;
  onBackdropClick?: () => void;
  onEscape?: () => void;
  children: React.ReactNode;
}

export const MotionModal: React.FC<MotionModalProps> = ({
  variant = 'sheet',
  overlayClassName = 'fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/65 backdrop-blur-xs p-0 sm:p-4 overflow-y-auto',
  panelClassName = '',
  ariaLabel,
  onBackdropClick,
  onEscape,
  children,
}) => {
  const prefersReducedMotion = useReducedMotion();

  useEffect(() => {
    if (!onEscape) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onEscape();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onEscape]);

  const panelMotion = (() => {
    if (prefersReducedMotion) {
      return {
        initial: { opacity: 0 },
        animate: { opacity: 1 },
        exit: { opacity: 0 },
        transition: { duration: 0.14 } as Transition,
      };
    }

    if (variant === 'drawer-right') {
      return {
        initial: { x: '100%', opacity: 0.85 },
        animate: { x: 0, opacity: 1 },
        exit: { x: '100%', opacity: 0.85 },
        transition: IOS27_MODAL_SPRING,
      };
    }

    if (variant === 'fullscreen') {
      return {
        initial: { y: 64, scale: 0.985, opacity: 0 },
        animate: { y: 0, scale: 1, opacity: 1 },
        exit: { y: 48, scale: 0.985, opacity: 0 },
        transition: IOS27_MODAL_SPRING,
      };
    }

    return {
      initial: { y: 48, scale: 0.98, opacity: 0 },
      animate: { y: 0, scale: 1, opacity: 1 },
      exit: { y: 36, scale: 0.98, opacity: 0 },
      transition: IOS27_MODAL_SPRING,
    };
  })();

  return (
    <motion.div
      data-no-tab-swipe="true"
      role="dialog"
      aria-modal="true"
      aria-label={ariaLabel}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={IOS27_BACKDROP_TRANSITION}
      onClick={(e) => {
        if (onBackdropClick && e.target === e.currentTarget) {
          onBackdropClick();
        }
      }}
      className={overlayClassName}
    >
      <motion.div
        initial={panelMotion.initial}
        animate={panelMotion.animate}
        exit={panelMotion.exit}
        transition={panelMotion.transition}
        className={`will-change-transform ${panelClassName}`}
      >
        {children}
      </motion.div>
    </motion.div>
  );
};
