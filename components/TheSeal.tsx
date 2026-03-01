/**
 * TheSeal - Vault Entry Component
 * Visual Goal: Breaking a physical seal or aligning a lock
 *
 * Features:
 * - Golden Line input field
 * - Circular border that fills as user types
 * - Rotating Plus (+) button that becomes X on unlock
 * - Cinnabar Red heartbeat animation on failure
 */

'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, X, User } from 'lucide-react';
import { useVoidStore } from '@/store/void-store';
import { useThemeStore } from '@/store/theme-store';
import { isWeakPassword } from '@/utils/password-strength';
import { USERNAME_RULE_HINT, validateUsername } from '@/utils/password-manager';

interface TheSealProps {
  onUnlock: (username: string, password: string) => Promise<void>;
  accountExists: boolean;
}

export function TheSeal({ onUnlock, accountExists }: TheSealProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isUnlocking, setIsUnlocking] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const vaultStatus = useVoidStore((state) => state.vaultStatus);
  const { theme } = useThemeStore();
  const normalizedUsername = username.trim();
  const hasUsername = normalizedUsername.length > 0;
  const isUsernameValid = !hasUsername || validateUsername(normalizedUsername);

  // Calculate seal progress based on input completeness
  const usernameProgress = Math.min((username.length / 8) * 50, 50);
  const passwordProgress = Math.min((password.length / 12) * 50, 50);
  const sealProgress = usernameProgress + passwordProgress;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!normalizedUsername || password.length === 0 || isUnlocking) return;
    if (!validateUsername(normalizedUsername)) {
      setErrorMessage(USERNAME_RULE_HINT);
      return;
    }

    setErrorMessage('');
    setIsUnlocking(true);
    try {
      await onUnlock(normalizedUsername, password);
    } catch (error) {
      console.error('Unlock failed:', error);
      if (error instanceof Error) {
        if (error.message === 'WEB_CRYPTO_UNAVAILABLE') {
          setErrorMessage('Secure encryption is unavailable in this environment. Use a modern browser over https:// or localhost.');
        } else if (error.message === 'USERNAME_INVALID') {
          setErrorMessage(USERNAME_RULE_HINT);
        } else if (error.message !== 'SEAL_BROKEN') {
          setErrorMessage('Sign-in failed. Please try again.');
        }
      } else {
        setErrorMessage('Sign-in failed. Please try again.');
      }
    } finally {
      setIsUnlocking(false);
    }
  };

  // Visual state classes
  const isSealBroken = vaultStatus === 'SEAL_BROKEN';
  const isUnsealing = vaultStatus === 'UNSEALING' || isUnlocking;
  const canSubmit =
    hasUsername && password.length > 0 && !isUnsealing && isUsernameValid;

  const circleColor = isSealBroken
    ? '#C41E3A' // Cinnabar Red
    : '#D4AF37'; // Gold

  return (
    <div className="flex items-center justify-center min-h-screen bg-ink">
      <form onSubmit={handleSubmit} className="relative">
        {/* The Seal - Circular border */}
        <motion.div
          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none"
          animate={
            isSealBroken
              ? {
                  scale: [1, 1.05, 1],
                  opacity: [0.4, 1, 0.4],
                }
              : {}
          }
          transition={
            isSealBroken
              ? {
                  duration: 1.5,
                  repeat: 3,
                  ease: 'easeInOut',
                }
              : {}
          }
        >
          <svg width="400" height="400" viewBox="0 0 400 400">
            {/* Background circle */}
            <circle
              cx="200"
              cy="200"
              r="180"
              fill="none"
              stroke={circleColor}
              strokeWidth="2"
              opacity="0.2"
            />
            {/* Progress circle - fills as user types */}
            <motion.circle
              cx="200"
              cy="200"
              r="180"
              fill="none"
              stroke={circleColor}
              strokeWidth="2"
              strokeDasharray={`${2 * Math.PI * 180}`}
              strokeDashoffset={`${2 * Math.PI * 180 * (1 - sealProgress / 100)}`}
              initial={{ strokeDashoffset: 2 * Math.PI * 180 }}
              animate={{
                strokeDashoffset: 2 * Math.PI * 180 * (1 - sealProgress / 100),
                opacity: isUnsealing ? [0.6, 1, 0.6] : 1,
              }}
              transition={{
                strokeDashoffset: { duration: 0.3 },
                opacity: isUnsealing
                  ? { duration: 1, repeat: Infinity, ease: 'easeInOut' }
                  : {},
              }}
              style={{
                transform: 'rotate(-90deg)',
                transformOrigin: '200px 200px',
              }}
            />
            {/* Crosshair markers at cardinal points */}
            {[0, 90, 180, 270].map((angle) => {
              const rad = (angle * Math.PI) / 180;
              const x = 200 + Math.cos(rad) * 180;
              const y = 200 + Math.sin(rad) * 180;
              return (
                <g key={angle} opacity="0.6">
                  <line
                    x1={x - 8}
                    y1={y}
                    x2={x + 8}
                    y2={y}
                    stroke={circleColor}
                    strokeWidth="1"
                  />
                  <line
                    x1={x}
                    y1={y - 8}
                    x2={x}
                    y2={y + 8}
                    stroke={circleColor}
                    strokeWidth="1"
                  />
                </g>
              );
            })}
          </svg>
        </motion.div>

        {/* Input Container */}
        <div className="relative z-10 flex flex-col items-center gap-12">
          {/* Title */}
          <motion.h1
            className={`font-serif text-4xl text-center ${theme === 'dark' ? 'text-silk' : 'text-gray-900'}`}
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            {accountExists ? 'Enter Remind' : 'Create Your Seal'}
          </motion.h1>

          {/* Subtitle */}
          <motion.p
            className={`text-sm text-center -mt-8 ${theme === 'dark' ? 'text-silk/60' : 'text-gray-500'}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
          >
            {accountExists ? 'Login with your account' : 'Create a new account'}
          </motion.p>

          {/* Input Container */}
          <div className="relative w-80 space-y-6">
            {/* Username Input */}
            <div className="relative">
              <div className="flex items-center gap-3 mb-2">
                <User className={`w-4 h-4 ${theme === 'dark' ? 'text-gold/60' : 'text-gray-400'}`} />
                <span className={`text-xs uppercase tracking-wider ${theme === 'dark' ? 'text-silk/40' : 'text-gray-400'}`}>Account</span>
              </div>
              <input
                type="text"
                name="username"
                autoComplete="username"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                value={username}
                onChange={(e) => {
                  setUsername(e.target.value);
                  if (errorMessage) {
                    setErrorMessage('');
                  }
                }}
                placeholder=""
                className={`w-full bg-transparent border-none outline-none text-xl text-center pb-2 font-sans tracking-wider ${theme === 'dark' ? 'text-silk' : 'text-gray-900'}`}
                autoFocus
                disabled={isUnsealing}
              />
              {/* The Horizon Line */}
              <motion.div
                className="absolute bottom-0 left-0 right-0 h-px"
                style={{ backgroundColor: circleColor }}
                animate={
                  isUnsealing
                    ? {
                        opacity: [0.4, 1, 0.4],
                      }
                    : {}
                }
                transition={
                  isUnsealing
                    ? {
                        duration: 1,
                        repeat: Infinity,
                        ease: 'easeInOut',
                      }
                    : {}
                }
              />
              {/* Placeholder text floating above */}
              <AnimatePresence>
                {username.length === 0 && (
                  <motion.div
                    className={`absolute left-1/2 -translate-x-1/2 -top-8 text-sm pointer-events-none ${theme === 'dark' ? 'text-silk/40' : 'text-gray-400'}`}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                  >
                    Enter your username...
                  </motion.div>
                )}
              </AnimatePresence>
              <p
                className={`mt-2 text-xs text-center ${
                  isUsernameValid
                    ? theme === 'dark'
                      ? 'text-silk/40'
                      : 'text-gray-500'
                    : theme === 'dark'
                    ? 'text-cinnabar/90'
                    : 'text-red-500'
                }`}
              >
                {USERNAME_RULE_HINT}
              </p>
            </div>

          {/* Password Input */}
          <div className="relative">
            <input
              type="password"
              name="password"
              autoComplete={accountExists ? 'current-password' : 'new-password'}
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (errorMessage) {
                  setErrorMessage('');
                }
              }}
              placeholder=""
              className={`w-full bg-transparent border-none outline-none text-xl text-center pb-2 font-sans tracking-wider ${theme === 'dark' ? 'text-silk' : 'text-gray-900'}`}
              disabled={isUnsealing}
            />
              {/* The Horizon Line */}
              <motion.div
                className="absolute bottom-0 left-0 right-0 h-px"
                style={{ backgroundColor: circleColor }}
                animate={
                  isUnsealing
                    ? {
                        opacity: [0.4, 1, 0.4],
                      }
                    : {}
                }
                transition={
                  isUnsealing
                    ? {
                        duration: 1,
                        repeat: Infinity,
                        ease: 'easeInOut',
                      }
                    : {}
                }
              />
              {/* Placeholder text floating above */}
              <AnimatePresence>
                {password.length === 0 && (
                  <motion.div
                    className={`absolute left-1/2 -translate-x-1/2 -top-8 text-sm pointer-events-none ${theme === 'dark' ? 'text-silk/40' : 'text-gray-400'}`}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                  >
                    {accountExists ? 'Enter your password...' : 'Create a password...'}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            {!accountExists && password.length > 0 && isWeakPassword(password) && (
              <p className={`text-xs mt-2 text-center ${theme === 'dark' ? 'text-cinnabar/80' : 'text-red-500'}`}>
                Weak password. Use at least 8 characters with mixed types.
              </p>
            )}
          </div>

          {/* The Unlock Button - Circular with Plus/X */}
          <motion.button
            type="submit"
            disabled={!canSubmit}
            className={`w-16 h-16 rounded-full flex items-center justify-center transition-all duration-300 ${
              !canSubmit
                ? 'bg-panel border border-gold/20 cursor-not-allowed'
                : isSealBroken
                ? 'bg-cinnabar/20 border-2 border-cinnabar'
                : 'bg-gold/10 border-2 border-gold hover:bg-gold/20 hover:shadow-lg hover:shadow-gold/30'
            }`}
            whileHover={canSubmit ? { scale: 1.1 } : {}}
            whileTap={canSubmit ? { scale: 0.9 } : {}}
            animate={{
              rotate: isUnsealing ? 45 : 0,
            }}
            transition={{ duration: 0.3 }}
          >
            {isUnsealing ? (
              <X className="w-6 h-6" style={{ color: circleColor }} />
            ) : (
              <Plus className="w-6 h-6" style={{ color: circleColor }} />
            )}
          </motion.button>

          {/* Error Message */}
          <AnimatePresence>
            {isSealBroken && (
              <motion.p
                className="text-cinnabar text-sm absolute -bottom-16"
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
              >
                The seal remains unbroken
              </motion.p>
            )}
          </AnimatePresence>
          <AnimatePresence>
            {errorMessage && (
              <motion.p
                className="text-cinnabar text-sm absolute -bottom-16 text-center max-w-80"
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
              >
                {errorMessage}
              </motion.p>
            )}
          </AnimatePresence>
        </div>

        {/* Status Text */}
        <AnimatePresence>
          {isUnsealing && (
            <motion.p
              className="absolute -bottom-24 left-1/2 -translate-x-1/2 text-gold/60 text-xs tracking-widest"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              UNSEALING...
            </motion.p>
          )}
        </AnimatePresence>
      </form>
    </div>
  );
}
