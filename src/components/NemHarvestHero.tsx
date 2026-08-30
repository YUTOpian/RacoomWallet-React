import { Box } from '@mui/material';
import nemMark from '../assets/icon_home_nem_blue.png';

/**
 * NEM (XEM) branded hero banner for the Harvest screen, mirroring
 * components/SymbolHarvestHero.tsx (same sprouting-leaf badge, rising coin motes, breathing
 * pulse ring and node-link glyph) but recolored with NEM's own tri-color gradient/lattice
 * (see components/NemHero.tsx) and mark instead of Symbol's violet, so it reads as this
 * chain's own harvesting screen rather than a palette-swapped copy of Symbol's.
 */
export default function NemHarvestHero() {
  return (
    <Box
      sx={{
        width: '100%',
        lineHeight: 0,
        '& .nem-harvest-hero-pulse': {
          transformBox: 'fill-box',
          transformOrigin: '50% 50%',
          animation: 'nemHarvestHeroPulse 3.4s ease-in-out infinite',
        },
        '& .nem-harvest-hero-mote-1': { animation: 'nemHarvestHeroRise 4.5s ease-in infinite' },
        '& .nem-harvest-hero-mote-2': { animation: 'nemHarvestHeroRise 4.5s ease-in infinite 1.5s' },
        '& .nem-harvest-hero-mote-3': { animation: 'nemHarvestHeroRise 4.5s ease-in infinite 3s' },
        '@media (prefers-reduced-motion: reduce)': {
          '& .nem-harvest-hero-pulse, & .nem-harvest-hero-mote-1, & .nem-harvest-hero-mote-2, & .nem-harvest-hero-mote-3': { animation: 'none' },
        },
        '@keyframes nemHarvestHeroPulse': {
          '0%, 100%': { transform: 'scale(1)', opacity: 0.45 },
          '50%': { transform: 'scale(1.1)', opacity: 0.85 },
        },
        '@keyframes nemHarvestHeroRise': {
          '0%': { transform: 'translateY(0px)', opacity: 0 },
          '15%': { opacity: 0.9 },
          '85%': { opacity: 0.4 },
          '100%': { transform: 'translateY(-46px)', opacity: 0 },
        },
      }}
    >
      <svg viewBox="0 0 720 200" width="100%" height="auto" role="img" aria-label="NEM Harvest">
        <defs>
          <linearGradient id="nemHarvestHeroBg" x1="0" y1="0" x2="720" y2="200" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#F28600" />
            <stop offset="50%" stopColor="#2A85DF" />
            <stop offset="100%" stopColor="#0FBCAB" />
          </linearGradient>
          <pattern id="nemHarvestHeroLattice" width="50" height="50" patternUnits="userSpaceOnUse">
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
          {/* Recolors the (blue-on-transparent) NEM mark PNG to solid white, keeping its
              alpha channel, so it reads cleanly against the gradient background below. */}
          <filter id="nemHarvestHeroWhiteify" x="-20%" y="-20%" width="140%" height="140%">
            <feColorMatrix type="matrix" values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 1 0" />
          </filter>
        </defs>

        <rect width="720" height="200" fill="url(#nemHarvestHeroBg)" />
        <rect width="720" height="200" fill="url(#nemHarvestHeroLattice)" />

        {/* Large tonal watermark of the NEM mark, bleeding off the right edge - same
            placement as the rest of the NEM hero family so the screens tile together. */}
        <image
          href={nemMark}
          x="500"
          y="-40"
          width="280"
          height="280"
          opacity="0.22"
          transform="rotate(8 640 100)"
          filter="url(#nemHarvestHeroWhiteify)"
        />

        {/* Gentle breathing pulse behind the badge - "ongoing", not "in transit" */}
        <circle className="nem-harvest-hero-pulse" cx="106" cy="100" r="58" fill="none" stroke="#FFFFFF" strokeOpacity="0.35" strokeWidth="2" />

        {/* Badge plate */}
        <circle cx="106" cy="100" r="56" fill="#FFFFFF" fillOpacity="0.14" />

        {/* Sprouting leaf, matching the app's own harvesting glyph
            (EnergySavingsLeafOutlinedIcon), same as SymbolHarvestHero */}
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
        <circle className="nem-harvest-hero-mote-1" cx="80" cy="40" r="5" fill="#FFFFFF" />
        <circle className="nem-harvest-hero-mote-2" cx="126" cy="34" r="4" fill="#FFFFFF" />
        <circle className="nem-harvest-hero-mote-3" cx="102" cy="24" r="3.5" fill="#FFFFFF" />

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
