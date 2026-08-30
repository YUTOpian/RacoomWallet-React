import { Box } from '@mui/material';
import symbolMark from '../assets/icon_home_symbol_green.png';

/**
 * Symbol (XYM) branded hero banner for the Receive screen specifically - previously this
 * screen reused SymbolHero (the Send screen's banner), whose paper-airplane-departing
 * motif reads as "sending a transaction away", which is backwards for a screen whose job
 * is to show *your own* address so someone else can send *to* you.
 *
 * Shares SymbolHero's brand language (the violet gradient, node-lattice texture, and the
 * app's own Symbol mark as badge + watermark) so the two screens still read as the same
 * chain section, but everything with a direction to it is reversed or replaced so this
 * doesn't just look like a copy of the Send banner:
 * - The badge sits on the right instead of the left, and the tonal watermark bleeds off
 *   the left edge instead of the right - a simple mirror so the two banners are never
 *   visually interchangeable at a glance.
 * - In place of the departing paper airplane, a small stack of chevrons flows *into* the
 *   badge from the outside, and the broadcast rings *contract* toward the badge instead of
 *   expanding away from it - together reading as "something arriving", the opposite of
 *   Send's "something leaving".
 */
export default function SymbolReceiveHero() {
  return (
    <Box
      sx={{
        width: '100%',
        lineHeight: 0,
        '& .symbol-receive-hero-chevrons': {
          transformBox: 'fill-box',
          transformOrigin: '50% 50%',
          animation: 'symbolReceiveHeroInflow 1.8s ease-in-out infinite',
        },
        '& .symbol-receive-hero-ring': {
          transformBox: 'fill-box',
          transformOrigin: '50% 50%',
          animation: 'symbolReceiveHeroContract 3.6s ease-out infinite',
        },
        '@media (prefers-reduced-motion: reduce)': {
          '& .symbol-receive-hero-chevrons, & .symbol-receive-hero-ring': { animation: 'none' },
        },
        '@keyframes symbolReceiveHeroInflow': {
          '0%, 100%': { transform: 'translateX(0px)', opacity: 0.9 },
          '50%': { transform: 'translateX(10px)', opacity: 0.4 },
        },
        '@keyframes symbolReceiveHeroContract': {
          '0%': { transform: 'scale(1.35)', opacity: 0 },
          '70%': { opacity: 0.4 },
          '100%': { transform: 'scale(0.75)', opacity: 0.35 },
        },
      }}
    >
      <svg viewBox="0 0 720 200" width="100%" height="auto" role="img" aria-label="Symbol Receive">
        <defs>
          <linearGradient id="symbolReceiveHeroBg" x1="720" y1="0" x2="0" y2="200" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#AE7EE9" />
            <stop offset="50%" stopColor="#8239DD" />
            <stop offset="100%" stopColor="#552590" />
          </linearGradient>
          <pattern id="symbolReceiveHeroLattice" width="50" height="50" patternUnits="userSpaceOnUse">
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
          <filter id="symbolReceiveHeroWhiteify" x="-20%" y="-20%" width="140%" height="140%">
            <feColorMatrix type="matrix" values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 1 0" />
          </filter>
        </defs>

        <rect width="720" height="200" fill="url(#symbolReceiveHeroBg)" />
        <rect width="720" height="200" fill="url(#symbolReceiveHeroLattice)" />

        {/* Large tonal watermark of the Symbol mark, bleeding off the LEFT edge - mirrored
            from SymbolHero, where it bleeds off the right */}
        <image
          href={symbolMark}
          x="-60"
          y="-40"
          width="280"
          height="280"
          opacity="0.22"
          transform="rotate(-8 80 100)"
          filter="url(#symbolReceiveHeroWhiteify)"
        />

        {/* Broadcast rings contracting toward the badge, the reverse of Send's expanding
            ripples - reads as a signal being drawn in rather than sent out */}
        <circle className="symbol-receive-hero-ring" cx="614" cy="100" r="58" fill="none" stroke="#FFFFFF" strokeOpacity="0.4" strokeWidth="2" />
        <circle className="symbol-receive-hero-ring" cx="614" cy="100" r="58" fill="none" stroke="#FFFFFF" strokeOpacity="0.4" strokeWidth="2" style={{ animationDelay: '1.8s' }} />

        {/* Crisp foreground badge on the RIGHT: soft plate + white silhouette of the mark */}
        <circle cx="614" cy="100" r="56" fill="#FFFFFF" fillOpacity="0.14" />
        <image
          href={symbolMark}
          x="570"
          y="56"
          width="88"
          height="88"
          filter="url(#symbolReceiveHeroWhiteify)"
        />

        {/* Chevrons flowing into the badge from the left - "something arriving", in place
            of Send's departing paper airplane */}
        <g className="symbol-receive-hero-chevrons">
          <path d="M330 78 L360 100 L330 122" fill="none" stroke="#FFFFFF" strokeOpacity="0.85" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M380 78 L410 100 L380 122" fill="none" stroke="#FFFFFF" strokeOpacity="0.55" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M430 78 L460 100 L430 122" fill="none" stroke="#FFFFFF" strokeOpacity="0.3" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
        </g>
      </svg>
    </Box>
  );
}
