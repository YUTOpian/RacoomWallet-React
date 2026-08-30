import { Box } from '@mui/material';
import symbolMark from '../assets/icon_home_symbol_green.png';

/**
 * Symbol (XYM) branded hero banner for the Backup screen - shares SymbolHero/
 * SymbolReceiveHero's brand language (the `#AE7EE9 → #8239DD → #552590` violet gradient,
 * node-lattice texture, and the app's own Symbol mark as a tonal watermark) so all three
 * screens read as the same chain section, but the motif is specific to what this screen
 * actually does: revealing a private key that must be kept safe.
 *
 * In place of Send's departing paper airplane or Receive's inbound chevrons, this shows a
 * key held inside a shield, with a slow protective pulse around it instead of the other
 * heroes' directional broadcast rings - "guarded", not "in motion". The key is drawn from
 * primitive shapes (not the Symbol mark asset) since it needs to read as a literal key at
 * a glance, independent of the brand mark watermark behind it.
 */
export default function SymbolBackupHero() {
  return (
    <Box
      sx={{
        width: '100%',
        lineHeight: 0,
        '& .symbol-backup-hero-pulse': {
          transformBox: 'fill-box',
          transformOrigin: '50% 50%',
          animation: 'symbolBackupHeroPulse 3.2s ease-in-out infinite',
        },
        '& .symbol-backup-hero-glint': {
          animation: 'symbolBackupHeroGlint 3.2s ease-in-out infinite',
        },
        '@media (prefers-reduced-motion: reduce)': {
          '& .symbol-backup-hero-pulse, & .symbol-backup-hero-glint': { animation: 'none' },
        },
        '@keyframes symbolBackupHeroPulse': {
          '0%, 100%': { transform: 'scale(1)', opacity: 0.5 },
          '50%': { transform: 'scale(1.08)', opacity: 0.9 },
        },
        '@keyframes symbolBackupHeroGlint': {
          '0%, 100%': { opacity: 0 },
          '45%': { opacity: 0 },
          '55%': { opacity: 1 },
          '65%': { opacity: 0 },
        },
      }}
    >
      <svg viewBox="0 0 720 200" width="100%" height="auto" role="img" aria-label="Symbol Backup">
        <defs>
          <linearGradient id="symbolBackupHeroBg" x1="0" y1="0" x2="720" y2="200" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#AE7EE9" />
            <stop offset="50%" stopColor="#8239DD" />
            <stop offset="100%" stopColor="#552590" />
          </linearGradient>
          <pattern id="symbolBackupHeroLattice" width="50" height="50" patternUnits="userSpaceOnUse">
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
          {/* Recolors the (teal-on-transparent) Symbol mark PNG to solid white, keeping
              its alpha channel, so it reads cleanly against the violet background below. */}
          <filter id="symbolBackupHeroWhiteify" x="-20%" y="-20%" width="140%" height="140%">
            <feColorMatrix type="matrix" values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 1 0" />
          </filter>
        </defs>

        <rect width="720" height="200" fill="url(#symbolBackupHeroBg)" />
        <rect width="720" height="200" fill="url(#symbolBackupHeroLattice)" />

        {/* Large tonal watermark of the Symbol mark, bleeding off the right edge - same
            placement as SymbolHero/SymbolReceiveHero so the three screens tile together
            as one visual family. */}
        <image
          href={symbolMark}
          x="500"
          y="-40"
          width="280"
          height="280"
          opacity="0.22"
          transform="rotate(8 640 100)"
          filter="url(#symbolBackupHeroWhiteify)"
        />

        {/* Slow protective pulse behind the badge - "guarded", not broadcasting */}
        <circle className="symbol-backup-hero-pulse" cx="106" cy="100" r="58" fill="none" stroke="#FFFFFF" strokeOpacity="0.35" strokeWidth="2" />

        {/* Shield badge plate */}
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

        {/* Key, drawn from primitive shapes so it reads as a literal key at a glance */}
        <g transform="rotate(-28 106 103)">
          <circle cx="86" cy="103" r="14" fill="none" stroke="#FFFFFF" strokeWidth="7" />
          <rect x="98" y="99" width="42" height="8" rx="4" fill="#FFFFFF" />
          <rect x="128" y="99" width="7" height="16" fill="#FFFFFF" />
          <rect x="138" y="99" width="7" height="20" fill="#FFFFFF" />
        </g>

        {/* Brief glint sweeping across the key, echoing the reveal/hide eye toggle below
            the image on the page itself */}
        <line
          className="symbol-backup-hero-glint"
          x1="66" y1="66" x2="146" y2="146"
          stroke="#FFFFFF" strokeOpacity="0.85" strokeWidth="3" strokeLinecap="round"
        />

        {/* Small padlock badge, reinforcing "this is protected" without repeating the key */}
        <g transform="translate(300 100)">
          <rect x="-16" y="-4" width="32" height="26" rx="6" fill="#FFFFFF" fillOpacity="0.9" />
          <path d="M-9 -4 V-14 C-9 -24 9 -24 9 -14 V-4" fill="none" stroke="#FFFFFF" strokeOpacity="0.9" strokeWidth="5" />
          <circle cx="0" cy="9" r="3.5" fill="#8239DD" />
        </g>
      </svg>
    </Box>
  );
}
