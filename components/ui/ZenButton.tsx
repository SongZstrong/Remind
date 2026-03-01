/**
 * ZenButton - Reusable Button Component
 * Implements the "Circular or Pill-shaped" design from the Eastern Futurism aesthetic
 */

'use client';

import { motion } from 'framer-motion';
import { type ReactNode } from 'react';
import { useThemeStore } from '@/store/theme-store';

interface ZenButtonProps {
  children: ReactNode;
  onClick?: () => void;
  variant?: 'circular' | 'pill';
  type?: 'button' | 'submit' | 'reset';
  disabled?: boolean;
  className?: string;
  icon?: ReactNode;
}

export function ZenButton({
  children,
  onClick,
  variant = 'pill',
  type = 'button',
  disabled = false,
  className = '',
  icon,
}: ZenButtonProps) {
  const { theme } = useThemeStore();

  const baseClasses = 'relative overflow-hidden font-sans transition-all duration-300';

  const variantClasses = {
    circular: 'w-16 h-16 rounded-full flex items-center justify-center',
    pill: 'px-8 py-3 rounded-full flex items-center gap-3',
  };

  const stateClasses = disabled
    ? theme === 'dark'
      ? 'bg-panel text-silk/30 cursor-not-allowed'
      : 'bg-gray-200 text-gray-400 cursor-not-allowed'
    : theme === 'dark'
      ? 'bg-gold/10 text-silk border border-gold hover:bg-gold/20 hover:shadow-lg hover:shadow-gold/20 cursor-pointer'
      : 'bg-gray-900 text-white border border-gray-900 hover:bg-gray-800 hover:shadow-lg hover:shadow-gray-500/20 cursor-pointer';

  return (
    <motion.button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`${baseClasses} ${variantClasses[variant]} ${stateClasses} ${className}`}
      whileHover={!disabled ? { scale: 1.05 } : {}}
      whileTap={!disabled ? { scale: 0.95 } : {}}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      {icon && <span className={theme === 'dark' ? 'text-gold' : 'text-white'}>{icon}</span>}
      {children}
    </motion.button>
  );
}
