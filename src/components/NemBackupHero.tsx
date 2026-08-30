import { Box } from '@mui/material';
import nemMark from '../assets/icon_home_nem_blue.png';

/**
 * NEM (XEM) branded hero banner for the Backup screen, mirroring
 * components/SymbolBackupHero.tsx exactly (shield + key + padlock motif, protective pulse
 * and glint) in NEM's brand blue instead of Symbol's violet - see components/NemHero.tsx
 * for why.
 */
export default function NemBackupHero() {
  return (
    <Box
      sx={{
        width: '100%',
        lineHeight: 0,
        '& .nem-backup-hero-pulse': {
          transformBox: 'fill-box',
          transformOrigin: '50% 50%',
          animation: 'nemBackupHeroPulse 3.2s ease-in-out infinite',
        },
        '& .nem-backup-hero-glint': {
          animation: 'nemBackupHeroGlint 3.2s ease-in-out infinite',
        },
        '@media (prefers-reduced-motion: reduce)': {
          '& .nem-backup-hero-pulse, & .nem-backup-hero-glint': { animation: 'none' },
        },
        '@keyframes nemBackupHeroPulse': {
          '0%, 100%': { transform: 'scale(1)', opacity: 0.5 },
          '50%': { transform: 'scale(1.08)', opacity: 0.9 },
        },
        '@keyframes nemBackupHeroGlint': {
          '0%, 100%': { opacity: 0 },
          '45%': { opacity: 0 },
          '55%': { opacity: 1 },
          '65%': { opacity: 0 },
        },
      }}
    >
      <svg viewBox="0 0 720 200" width="100%" height="auto" role="img" aria-label="NEM Backup">
        <defs>
          <linearGradient id="nemBackupHeroBg" x1="0" y1="0" x2="720" y2="200" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#F28600" />
            <stop offset="50%" stopColor="#2A85DF" />
            <stop offset="100%" stopColor="#0FBCAB" />
          </linearGradient>
          <pattern id="nemBackupHeroLattice" width="50" height="50" patternUnits="userSpaceOnUse">
            <g stroke="#FFFFFF" strokeOpacity="0.16" strokeWidth="1">
              <path d="M0 0 H50 M0 0 V50 M50 0 V50 M0 50 H50 M0 0 L25 25 M50 0 L25 25 M0 50 L25 25 M50 50 L25 25" fill="none" />
            </g>
            <g fill="#FFFFFF" fillOpacity="0.3">
              <circle cx="0" cy="0" r="2" />
              <circle cx="50" cy="0" r="2" />
              <circle cx="0" cy="50" r="2" />
              <circle cx="50" cy="50" r="2" />
              <circle cx="25" cy="25" r="2" />
            </g>
          </pattern>
          <filter id="nemBackupHeroWhiteify" x="-20%" y="-20%" width="140%" height="140%">
            <feColorMatrix type="matrix" values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 1 0" />
          </filter>
        </defs>

        <rect width="720" height="200" fill="url(#nemBackupHeroBg)" />
        <rect width="720" height="200" fill="url(#nemBackupHeroLattice)" />

        <image
          href={nemMark}
          x="500"
          y="-40"
          width="280"
          height="280"
          opacity="0.22"
          transform="rotate(8 640 100)"
          filter="url(#nemBackupHeroWhiteify)"
        />

        <circle className="nem-backup-hero-pulse" cx="106" cy="100" r="58" fill="none" stroke="#FFFFFF" strokeOpacity="0.35" strokeWidth="2" />

        <path
          d="M106 46 L150 62 V100 C150 130 132 150 106 160 C80 150 62 130 62 100 V62 Z"
          fill="#FFFFFF"
          fillOpacity="0.14"
        />
        <path
          d="M106 46 L150 62 V100 C150 130 132 150 106 160 C80 150 62 130 62 100 V62 Z"
          fill="none"
          stroke="#FFFFFF"
          strokeOpacity="0.55"
          strokeWidth="2"
        />

        <g transform="rotate(-28 106 103)">
          <circle cx="86" cy="103" r="14" fill="none" stroke="#FFFFFF" strokeWidth="7" />
          <rect x="98" y="99" width="42" height="8" rx="4" fill="#FFFFFF" />
          <rect x="128" y="99" width="7" height="16" fill="#FFFFFF" />
          <rect x="138" y="99" width="7" height="20" fill="#FFFFFF" />
        </g>

        <line
          className="nem-backup-hero-glint"
          x1="66" y1="66" x2="146" y2="146"
          stroke="#FFFFFF" strokeOpacity="0.85" strokeWidth="3" strokeLinecap="round"
        />

        <g transform="translate(300 100)">
          <rect x="-16" y="-4" width="32" height="26" rx="6" fill="#FFFFFF" fillOpacity="0.9" />
          <path d="M-9 -4 V-14 C-9 -24 9 -24 9 -14 V-4" fill="none" stroke="#FFFFFF" strokeOpacity="0.9" strokeWidth="5" />
          <circle cx="0" cy="9" r="3.5" fill="#2A85DF" />
        </g>
      </svg>
    </Box>
  );
}
