/**
 * OrbitalBackground - "The Celestial Sphere"
 * Slow-rotating geometric rings for the Landing Page
 * Represents the "Shield" (Encryption) in motion
 */

'use client';

import { useThemeStore } from '@/store/theme-store';

export function OrbitalBackground() {
  const { theme } = useThemeStore();

  // Theme-aware colors
  const goldColor = theme === 'dark' ? '#D4AF37' : '#c4a030';

  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none">
      {/* Outer Ring - Slowest rotation (60s) */}
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 animate-spin-slower">
        <svg width="800" height="800" viewBox="0 0 800 800" className="opacity-20">
          <circle
            cx="400"
            cy="400"
            r="350"
            fill="none"
            stroke={`url(#goldGradient-${theme})`}
            strokeWidth="1"
            strokeDasharray="4 8"
          />
          <defs>
            <linearGradient id={`goldGradient-${theme}`} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor={goldColor} stopOpacity="0.3" />
              <stop offset="100%" stopColor={goldColor} stopOpacity="0.8" />
            </linearGradient>
          </defs>
        </svg>
      </div>

      {/* Middle Ring - Medium rotation (30s) */}
      <div
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 animate-spin-slow"
        style={{ animationDirection: 'reverse' }}
      >
        <svg width="600" height="600" viewBox="0 0 600 600" className="opacity-30">
          <circle
            cx="300"
            cy="300"
            r="250"
            fill="none"
            stroke={goldColor}
            strokeWidth="1"
          />
          {/* Crosshair markers at cardinal points */}
          <g className="text-gold">
            {[0, 90, 180, 270].map((angle) => {
              const rad = (angle * Math.PI) / 180;
              const x = 300 + Math.cos(rad) * 250;
              const y = 300 + Math.sin(rad) * 250;
              return (
                <g key={angle}>
                  <line
                    x1={x - 5}
                    y1={y}
                    x2={x + 5}
                    y2={y}
                    stroke={goldColor}
                    strokeWidth="1"
                  />
                  <line
                    x1={x}
                    y1={y - 5}
                    x2={x}
                    y2={y + 5}
                    stroke={goldColor}
                    strokeWidth="1"
                  />
                </g>
              );
            })}
          </g>
        </svg>
      </div>

      {/* Inner Ring - Fastest rotation (15s) */}
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 animate-spin-fast">
        <svg width="400" height="400" viewBox="0 0 400 400" className="opacity-40">
          <circle
            cx="200"
            cy="200"
            r="150"
            fill="none"
            stroke={goldColor}
            strokeWidth="2"
          />
          <circle cx="200" cy="200" r="3" fill={goldColor} />
        </svg>
      </div>

      {/* Center Crosshair - Static "The Core" */}
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
        <svg
          width="60"
          height="60"
          viewBox="0 0 60 60"
          className="opacity-60 animate-spin-medium"
        >
          <line x1="30" y1="10" x2="30" y2="50" stroke={goldColor} strokeWidth="2" />
          <line x1="10" y1="30" x2="50" y2="30" stroke={goldColor} strokeWidth="2" />
          <circle cx="30" cy="30" r="5" fill="none" stroke={goldColor} strokeWidth="2" />
        </svg>
      </div>
    </div>
  );
}
