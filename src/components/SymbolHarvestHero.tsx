import { Box } from '@mui/material';
import symbolMark from '../assets/icon_home_symbol_green.png';

/**
 * Symbol (XYM) branded hero banner for the Harvest screen specifically - previously this
 * screen reused SymbolHero (the Send screen's banner), whose departing-paper-airplane motif
 * has nothing to do with delegated harvesting; it was only there because no dedicated hero
 * existed yet (see SymbolBackupHero/SymbolReceiveHero, which already got this treatment).
 *
 * Shares the family's brand language (the `#AE7EE9 → #8239DD → #552590` violet gradient,
 * node-lattice texture, and the app's own Symbol mark as badge + tonal watermark) so it
 * still reads as the same chain section, but the motif is specific to what harvesting is:
 * delegating to a node so it produces blocks - and yield - on the account's behalf.
 * - In place of a key (Backup) or inbound chevrons (Receive), the badge holds a sprouting
 *   leaf - this app's own harvesting glyph, already used on the "setup complete" screen
 *   (EnergySavingsLeafOutlinedIcon) - so the icon language matches across the flow.
 * - Small coin-like motes drift slowly upward and fade out above the badge, reading as
 *   "yield accruing over time" - a slow background process, not a one-off send/receive.
 * - The pulse ring around the badge breathes gently rather than broadcasting outward or
 *   contracting inward, echoing "ongoing" rather than "in transit".
 */
export default function SymbolHarvestHero() {
  return (
    <Box
      sx={{
        width: '100%',
        lineHeight: 0,
        '& .symbol-harvest-hero-pulse': {
          transformBox: 'fill-box',
          transformOrigin: '50% 50%',
          animation: 'symbolHarvestHeroPulse 3.4s ease-in-out infinite',
        },
        '& .symbol-harvest-hero-mote-1': { animation: 'symbolHarvestHeroRise 4.5s ease-in infinite' },
        '& .symbol-harvest-hero-mote-2': { animation: 'symbolHarvestHeroRise 4.5s ease-in infinite 1.5s' },
        '& .symbol-harvest-hero-mote-3': { animation: 'symbolHarvestHeroRise 4.5s ease-in infinite 3s' },
        '@media (prefers-reduced-motion: reduce)': {
          '& .symbol-harvest-hero-pulse, & .symbol-harvest-hero-mote-1, & .symbol-harvest-hero-mote-2, & .symbol-harvest-hero-mote-3': { animation: 'none' },
        },
        '@keyframes symbolHarvestHeroPulse': {
          '0%, 100%': { transform: 'scale(1)', opacity: 0.45 },
          '50%': { transform: 'scale(1.1)', opacity: 0.85 },
        },
        '@keyframes symbolHarvestHeroRise': {
          '0%': { transform: 'translateY(0px)', opacity: 0 },
          '15%': { opacity: 0.9 },
          '85%': { opacity: 0.4 },
          '100%': { transform: 'translateY(-46px)', opacity: 0 },
        },
      }}
    >
      <svg viewBox="0 0 720 200" width="100%" height="auto" role="img" aria-label="Symbol Harvest">
        <defs>
          <linearGradient id="symbolHarvestHeroBg" x1="0" y1="0" x2="720" y2="200" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#AE7EE9" />
            <stop offset="50%" stopColor="#8239DD" />
            <stop offset="100%" stopColor="#552590" />
          </linearGradient>
          <pattern id="symbolHarvestHeroLattice" width="50" height="50" patternUnits="userSpaceOnUse">
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
          <filter id="symbolHarvestHeroWhiteify" x="-20%" y="-20%" width="140%" height="140%">
            <feColorMatrix type="matrix" values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 1 0" />
          </filter>
        </defs>

        <rect width="720" height="200" fill="url(#symbolHarvestHeroBg)" />
        <rect width="720" height="200" fill="url(#symbolHarvestHeroLattice)" />

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
          filter="url(#symbolHarvestHeroWhiteify)"
        />

        {/* Gentle breathing pulse behind the badge - "ongoing", not "in transit" */}
        <circle className="symbol-harvest-hero-pulse" cx="106" cy="100" r="58" fill="none" stroke="#FFFFFF" strokeOpacity="0.35" strokeWidth="2" />

        {/* Badge plate */}
        <circle cx="106" cy="100" r="56" fill="#FFFFFF" fillOpacity="0.14" />

        {/* Sprouting leaf, drawn from primitive shapes so it matches the app's own
            harvesting glyph (EnergySavingsLeafOutlinedIcon) rather than borrowing an
            unrelated icon */}
        <g transform="translate(106 108)">
          <rect x="-4" y="-10" width="8" height="40" rx="4" fill="#FFFFFF" />
          <path
            d="M0 -6 C -30 -6 -34 -34 -34 -34 C -34 -34 -6 -30 -6 0 Z"
            fill="#FFFFFF"
            fillOpacity="0.92"
          />
          <path
            d="M0 -20 C -22 -20 -25 -40 -25 -40 C -25 -40 -5 -37 -5 -18 Z"
            fill="#FFFFFF"
            fillOpacity="0.75"
            transform="rotate(38)"
          />
        </g>

        {/* Coin-like motes drifting upward from the badge, reading as yield accruing */}
        <circle className="symbol-harvest-hero-mote-1" cx="80" cy="40" r="5" fill="#FFFFFF" />
        <circle className="symbol-harvest-hero-mote-2" cx="126" cy="34" r="4" fill="#FFFFFF" />
        <circle className="symbol-harvest-hero-mote-3" cx="102" cy="24" r="3.5" fill="#FFFFFF" />

        {/* Small blockchain-link glyph off to the side, tying "harvesting" to "this
            delegates to a node on the network" without repeating the lattice watermark */}
        <g transform="translate(300 100)" stroke="#FFFFFF" strokeOpacity="0.9" strokeWidth="5" fill="none">
          <rect x="-24" y="-11" width="22" height="22" rx="8" />
          <rect x="2" y="-11" width="22" height="22" rx="8" />
        </g>
      </svg>
    </Box>
  );
}
