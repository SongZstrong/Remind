/**
 * Landing Page - "The Celestial Sphere"
 * Visual Goal: Abstract representation of data protection as a planetary alignment
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Circle, Minus, Plus } from 'lucide-react';
import { OrbitalBackground } from '@/components/layout/OrbitalBackground';
import { TheSeal } from '@/components/TheSeal';
import { BambooScroll } from '@/components/BambooScroll';
import { ZenButton } from '@/components/ui/ZenButton';
import { useVoidStore } from '@/store/void-store';
import { useFileSystem } from '@/hooks/useFileSystem';
import { useLocalVault } from '@/hooks/useLocalVault';
import {
  accountExists,
  createAccount,
  verifyAccount,
  getCurrentUser,
  setCurrentUser,
  isVaultLocked,
  setVaultLocked,
  clearVaultLock,
  validateUsername,
} from '@/utils/password-manager';

export default function Home() {
  const [showSeal, setShowSeal] = useState(false);
  const [isVoidOpen, setIsVoidOpen] = useState(false);
  const [currentUsername, setCurrentUsername] = useState('');
  const [hasExistingAccount, setHasExistingAccount] = useState(false);
  const [hasSession, setHasSession] = useState(false);
  const [isResuming, setIsResuming] = useState(false);
  const [resumeError, setResumeError] = useState('');

  const { detectDevice, device, openVoid, setMasterPassword, lockVault } = useVoidStore();
  const fileSystemAdapter = useFileSystem();
  const localVaultAdapter = useLocalVault();
  const supportsFileSystem = typeof window !== 'undefined' && 'showDirectoryPicker' in window;
  const [isLocked, setIsLocked] = useState(false);

  useEffect(() => {
    detectDevice();

    // Check whether there is an active signed-in user
    const currentUser = getCurrentUser();
    const locked = isVaultLocked();
    setIsLocked(locked);
    if (currentUser && !locked) {
      setCurrentUsername(currentUser);
      setHasSession(true);
      setHasExistingAccount(accountExists(currentUser));
    } else if (currentUser) {
      setCurrentUsername(currentUser);
      setHasSession(false);
      setHasExistingAccount(accountExists(currentUser));
      setShowSeal(true);
    }
  }, [detectDevice]);

  const resumeVoid = useCallback(async () => {
    if (isResuming || !hasSession || isLocked) {
      return;
    }

    setResumeError('');
    setIsResuming(true);

    try {
      const adapter = supportsFileSystem ? fileSystemAdapter : localVaultAdapter;
      await openVoid(adapter);
      setIsVoidOpen(true);
    } catch (error) {
      console.error('Failed to resume Remind:', error);
      setResumeError('Unable to reopen the vault');
    } finally {
      setIsResuming(false);
    }
  }, [hasSession, isResuming, isLocked, supportsFileSystem, fileSystemAdapter, localVaultAdapter, openVoid]);

  useEffect(() => {
    if (!hasSession || isVoidOpen || isResuming || isLocked) {
      return;
    }

    if (!supportsFileSystem) {
      resumeVoid();
    }
  }, [hasSession, isVoidOpen, isResuming, isLocked, supportsFileSystem, resumeVoid]);

  const handleEnterVoid = async () => {
    if (hasSession) {
      await resumeVoid();
      return;
    }

    setShowSeal(true);
  };

  const handleUnlock = async (username: string, password: string) => {
    try {
      if (!validateUsername(username)) {
        throw new Error('USERNAME_INVALID');
      }

      // Check whether the account already exists
      const exists = accountExists(username);
      setHasExistingAccount(exists);

      if (exists) {
        // Verify account credentials
        const isValid = await verifyAccount(username, password);
        if (!isValid) {
          // Wrong password: trigger SEAL_BROKEN
          throw new Error('SEAL_BROKEN');
        }
      } else {
        // Account does not exist yet, create it
        await createAccount(username, password);
      }

      setCurrentUser(username);
      clearVaultLock();
      setIsLocked(false);

      // Store master password in state
      await setMasterPassword(password);
      setCurrentUsername(username);
      setHasSession(true);

      // Choose appropriate adapter
      const adapter = supportsFileSystem ? fileSystemAdapter : localVaultAdapter;

      // Open the void
      await openVoid(adapter);

      setIsVoidOpen(true);
    } catch (error) {
      console.error('Failed to enter Remind:', error);
      throw error;
    }
  };

  const triggerAutoLock = useCallback(() => {
    setVaultLocked(true);
    setIsLocked(true);
    lockVault();
    setIsVoidOpen(false);
    setShowSeal(true);
    setHasSession(false);
    setIsResuming(false);
  }, [lockVault]);

  useEffect(() => {
    if (!isVoidOpen) {
      return;
    }

    const idleTimeoutMs = 5 * 60 * 1000;
    let idleTimer: number | null = null;

    const resetTimer = () => {
      if (idleTimer) {
        window.clearTimeout(idleTimer);
      }
      idleTimer = window.setTimeout(() => {
        triggerAutoLock();
      }, idleTimeoutMs);
    };

    const handleVisibility = () => {
      if (document.hidden) {
        triggerAutoLock();
      }
    };

    resetTimer();
    window.addEventListener('mousemove', resetTimer);
    window.addEventListener('keydown', resetTimer);
    window.addEventListener('scroll', resetTimer);
    window.addEventListener('touchstart', resetTimer);
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      if (idleTimer) {
        window.clearTimeout(idleTimer);
      }
      window.removeEventListener('mousemove', resetTimer);
      window.removeEventListener('keydown', resetTimer);
      window.removeEventListener('scroll', resetTimer);
      window.removeEventListener('touchstart', resetTimer);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [isVoidOpen, triggerAutoLock]);

  const handleLogout = () => {
    clearVaultLock();
    setIsLocked(false);
    setIsVoidOpen(false);
    setShowSeal(true);
    setHasSession(false);
    setCurrentUsername('');
    setHasExistingAccount(false);
    setIsResuming(false);
    setResumeError('');
  };

  if (isVoidOpen) {
    return <BambooScroll onLogout={handleLogout} />;
  }

  if (showSeal) {
    return <TheSeal onUnlock={handleUnlock} accountExists={hasExistingAccount} />;
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-ink">
      {/* Animated Background */}
      <OrbitalBackground />

      {/* Main Content */}
      <div className="relative z-10 flex flex-col items-center justify-center min-h-screen px-4">
        {/* Hero Section - The Geometric Eclipse */}
        <motion.div
          className="flex flex-col items-center gap-12 mb-24"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
        >
          {/* The Eclipse Visual */}
          <div className="relative w-48 h-48 flex items-center justify-center">
            {/* Glowing Golden Rim */}
            <motion.div
              className="absolute inset-0 rounded-full border-2 border-gold opacity-60"
              animate={{
                scale: [1, 1.1, 1],
                opacity: [0.4, 0.8, 0.4],
              }}
              transition={{
                duration: 3,
                repeat: Infinity,
                ease: 'easeInOut',
              }}
            />
            {/* Black Circle (The Shield) */}
            <div className="absolute inset-4 rounded-full bg-panel border border-gold/40" />
            {/* Rotating Cross (The Core) */}
            <motion.div
              animate={{ rotate: 360 }}
              transition={{
                duration: 20,
                repeat: Infinity,
                ease: 'linear',
              }}
            >
              <Plus className="w-12 h-12 text-gold" strokeWidth={1.5} />
            </motion.div>
          </div>

          {/* Hero Text */}
          <div className="text-center space-y-4">
            <h1 className="font-serif text-6xl text-silk tracking-tight">
              Remind
            </h1>
            <p className="text-silk/60 text-lg font-sans max-w-md">
              Free secure browser-based online Markdown reading and editing.
            </p>
          </div>
        </motion.div>

        {/* Features Row - Constellation Style */}
        <motion.div
          className="flex items-center gap-8 mb-16"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4, duration: 0.8 }}
        >
          {/* The Constellation Line */}
          <div className="relative flex items-center gap-24">
            {/* Connecting Line */}
            <div className="absolute left-0 right-0 h-px bg-gold/20 top-1/2 -translate-y-1/2 -z-10" />

            {/* Feature Node 1: Encryption */}
            <div className="flex flex-col items-center gap-4 bg-ink p-4">
              <div className="w-16 h-16 rounded-full border border-gold flex items-center justify-center">
                <Circle className="w-6 h-6 text-gold" fill="currentColor" />
              </div>
              <div className="text-center">
                <h3 className="text-silk font-sans text-sm font-semibold mb-1">
                  Local Storage
                </h3>
                <p className="text-silk/40 text-xs max-w-[120px]">
                  Private notebook data stays on your device
                </p>
              </div>
            </div>

            {/* Feature Node 2: No Tracking */}
            <div className="flex flex-col items-center gap-4 bg-ink p-4">
              <div className="w-16 h-16 rounded-full border border-gold flex items-center justify-center">
                <Circle className="w-6 h-6 text-gold" />
                <Minus className="w-8 h-px text-gold absolute" />
              </div>
              <div className="text-center">
                <h3 className="text-silk font-sans text-sm font-semibold mb-1">
                  Markdown
                </h3>
                <p className="text-silk/40 text-xs max-w-[120px]">
                  Read and edit Markdown directly in your browser
                </p>
              </div>
            </div>

            {/* Feature Node 3: Open Source */}
            <div className="flex flex-col items-center gap-4 bg-ink p-4">
              <div className="w-16 h-16 rounded-full border border-gold flex items-center justify-center relative">
                <Circle className="w-8 h-8 text-gold absolute -left-1" strokeWidth={1.5} />
                <Circle className="w-8 h-8 text-gold absolute -right-1" strokeWidth={1.5} />
              </div>
              <div className="text-center">
                <h3 className="text-silk font-sans text-sm font-semibold mb-1">
                  Encryption
                </h3>
                <p className="text-silk/40 text-xs max-w-[120px]">
                  Secure online privacy notebook experience
                </p>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Call to Action */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6, duration: 0.8 }}
        >
          <ZenButton onClick={handleEnterVoid} variant="pill" disabled={hasSession && isResuming}>
            {hasSession ? (isResuming ? 'Resuming...' : 'Resume Remind') : 'Enter Remind'}
          </ZenButton>
        </motion.div>

        {/* Device Info (subtle) */}
        <motion.p
          className="absolute bottom-8 text-silk/20 text-xs"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1 }}
        >
          {device.adapterType === 'filesystem' ? 'Desktop Mode' : 'Mobile Mode'} 
          {/* {device.adapterType === 'filesystem' ? 'Desktop Mode' : 'Mobile Mode'} • {device.adapterType} */}
          {hasSession && currentUsername ? ` • Signed in as ${currentUsername}` : ''}
        </motion.p>

        {resumeError && (
          <motion.p
            className="absolute bottom-12 text-cinnabar/80 text-xs"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            {resumeError}
          </motion.p>
        )}
      </div>
    </div>
  );
}
