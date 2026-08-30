import { Box } from '@mui/material';
import symbolMark from '../assets/icon_home_symbol_green.png';

/**
 * Symbol (XYM) branded hero banner for the harvesting node-selection screen specifically -
 * this screen previously had no hero of its own at all (it went straight from the app bar
 * into the node list), unlike the rest of the Symbol flow (SymbolHero/SymbolBackupHero/
 * SymbolReceiveHero/SymbolHarvestHero).
 *
 * Shares the family's brand language (the `#AE7EE9 → #8239DD → #552590` violet gradient,
 * node-lattice texture, and the app's own Symbol mark as a tonal watermark) so it reads as
 * part of the same chain section, but the foreground motif is specific to *choosing one
 * node out of many* rather than to sending, receiving, backing up, or harvesting in
 * general:
 * - Several small lattice nodes are drawn as plain dots, with one singled out by a
 *   focus ring and a lightly larger, brighter dot - "this is the one you're about to pick".
 * - A small pointing hand/tap glyph rests on the highlighted node, making the "select"
 *   action legible at a glance instead of implying a transaction is already happening.
 */
export default function SymbolNodeSelectHero() {
  return (
    <Box
      sx={{
        width: '100%',
        lineHeight: 0,
        '& .symbol-nodeselect-hero-focus': {
          transformBox: 'fill-box',
          transformOrigin: '50% 50%',
          animation: 'symbolNodeSelectHeroFocus 2.4s ease-in-out infinite',
        },
        '@media (prefers-reduced-motion: reduce)': {
          '& .symbol-nodeselect-hero-focus': { animation: 'none' },
        },
        '@keyframes symbolNodeSelectHeroFocus': {
          '0%, 100%': { transform: 'scale(1)', opacity: 0.5 },
          '50%': { transform: 'scale(1.18)', opacity: 0.95 },
        },
      }}
    >
      <svg viewBox="0 0 720 200" width="100%" height="auto" role="img" aria-label="Select a node">
        <defs>
          <linearGradient id="symbolNodeSelectHeroBg" x1="0" y1="0" x2="720" y2="200" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#AE7EE9" />
            <stop offset="50%" stopColor="#8239DD" />
            <stop offset="100%" stopColor="#552590" />
          </linearGradient>
          <pattern id="symbolNodeSelectHeroLattice" width="50" height="50" patternUnits="userSpaceOnUse">
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
          <filter id="symbolNodeSelectHeroWhiteify" x="-20%" y="-20%" width="140%" height="140%">
            <feColorMatrix type="matrix" values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 1 0" />
          </filter>
        </defs>

        <rect width="720" height="200" fill="url(#symbolNodeSelectHeroBg)" />
        <rect width="720" height="200" fill="url(#symbolNodeSelectHeroLattice)" />

        {/* Large tonal watermark of the Symbol mark, bleeding off the right edge - same
            placement as the rest of the Symbol hero family so the screens tile together. */}
        <image
          href={symbolMark}
          x="500"
          y="-40"
          width="280"
          height="280"
          opacity="0.22"
          transform="rotate(8 640 100)"
          filter="url(#symbolNodeSelectHeroWhiteify)"
        />

        {/* A small cluster of candidate nodes, connected by thin lines, echoing the
            watermark's lattice at a legible scale in the foreground */}
        <g stroke="#FFFFFF" strokeOpacity="0.4" strokeWidth="1.5">
          <line x1="66" y1="70" x2="126" y2="100" />
          <line x1="126" y1="100" x2="70" y2="138" />
          <line x1="126" y1="100" x2="176" y2="66" />
          <line x1="126" y1="100" x2="180" y2="132" />
        </g>
        <circle cx="66" cy="70" r="7" fill="#FFFFFF" fillOpacity="0.55" />
        <circle cx="70" cy="138" r="7" fill="#FFFFFF" fillOpacity="0.55" />
        <circle cx="176" cy="66" r="7" fill="#FFFFFF" fillOpacity="0.55" />
        <circle cx="180" cy="132" r="7" fill="#FFFFFF" fillOpacity="0.55" />

        {/* The highlighted candidate - larger, brighter, with a pulsing focus ring -
            "this is the one you're about to pick" */}
        <circle className="symbol-nodeselect-hero-focus" cx="126" cy="100" r="26" fill="none" stroke="#FFFFFF" strokeOpacity="0.55" strokeWidth="2" />
        <circle cx="126" cy="100" r="13" fill="#FFFFFF" />

        {/* Pointing hand / tap glyph resting on the highlighted node, making "select"
            legible without implying a transaction is already underway */}
        <g transform="translate(150 118)">
          <path
            d="M0 20 L0 2 C0 -2 6 -2 6 2 L6 12 L8 12 L8 4 C8 0 14 0 14 4 L14 12 L16 12 L16 6 C16 2 22 2 22 6 L22 20 C22 26 17 30 11 30 C6 30 2 27 0 22 Z"
            fill="#FFFFFF"
            fillOpacity="0.92"
            transform="scale(0.85) rotate(-18)"
          />
        </g>
      </svg>
    </Box>
  );
}
