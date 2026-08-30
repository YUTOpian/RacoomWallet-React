import { Box } from '@mui/material';
import symbolMark from '../assets/icon_home_symbol_green.png';

/**
 * Symbol (XYM) branded hero banner, used in place of the app's generic send/receive hero
 * (heroimage_send_small.png - a seasonal snowflake pattern shared with the EVM chains'
 * send flow, with nothing chain-specific about it).
 *
 * Built from the app's own Symbol identity instead of generic decoration:
 * - Symbol's brand violet as the gradient base - the same `#AE7EE9 → #8239DD → #552590`
 *   gradient already used on the Symbol balance card (see SymbolTop.tsx's
 *   BALANCE_CARD_GRADIENT, sourced from the reference violet swatch #8239DD), so this hero
 *   and the balance card read as the same identity rather than two different guesses at it.
 * - The app's existing Symbol brand mark (assets/icon_home_symbol_green.png) as both a
 *   crisp badge and a large tonal watermark. The source PNG is solid teal-on-transparent,
 *   which would clash with the violet background, so an SVG `feColorMatrix` filter
 *   (`#symbolHeroWhiteify` below) recolors every opaque pixel to solid white while leaving
 *   the alpha channel untouched, rendering it as a clean white silhouette instead. This
 *   uses an SVG filter primitive rather than the CSS `filter` shorthand because the latter
 *   renders inconsistently on `<image>` elements across renderers - the SVG primitive is
 *   the more portable choice.
 * - A triangulated node-lattice tiling in the background in place of snowflakes - Symbol is
 *   a distributed-ledger network, so "connected nodes" reads as on-brand texture rather
 *   than decoration.
 * - A single paper airplane (this app's established send motif elsewhere) flying away from
 *   the mark badge toward the network watermark, tying "this is a Symbol account" and
 *   "this screen sends a transaction" into one image instead of two unrelated ones.
 */
export default function SymbolHero() {
  return (
    <Box
      sx={{
        width: '100%',
        lineHeight: 0,
        '& .symbol-hero-plane': {
          transformBox: 'fill-box',
          transformOrigin: '50% 50%',
          animation: 'symbolHeroPlaneDrift 6s ease-in-out infinite',
        },
        '& .symbol-hero-ripple': {
          transformBox: 'fill-box',
          transformOrigin: '50% 50%',
          animation: 'symbolHeroRipple 3.6s ease-out infinite',
        },
        '@media (prefers-reduced-motion: reduce)': {
          '& .symbol-hero-plane, & .symbol-hero-ripple': { animation: 'none' },
        },
        '@keyframes symbolHeroPlaneDrift': {
          '0%, 100%': { transform: 'translate(0px, 0px)' },
          '50%': { transform: 'translate(10px, -8px)' },
        },
        '@keyframes symbolHeroRipple': {
          '0%': { transform: 'scale(0.75)', opacity: 0.35 },
          '100%': { transform: 'scale(1.35)', opacity: 0 },
        },
      }}
    >
      <svg viewBox="0 0 720 200" width="100%" height="auto" role="img" aria-label="Symbol">
        <defs>
          <linearGradient id="symbolHeroBg" x1="0" y1="0" x2="720" y2="200" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#AE7EE9" />
            <stop offset="50%" stopColor="#8239DD" />
            <stop offset="100%" stopColor="#552590" />
          </linearGradient>
          <pattern id="symbolHeroLattice" width="50" height="50" patternUnits="userSpaceOnUse">
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
          <filter id="symbolHeroWhiteify" x="-20%" y="-20%" width="140%" height="140%">
            <feColorMatrix type="matrix" values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 1 0" />
          </filter>
        </defs>

        <rect width="720" height="200" fill="url(#symbolHeroBg)" />
        <rect width="720" height="200" fill="url(#symbolHeroLattice)" />

        {/* Large tonal watermark of the Symbol mark, bleeding off the right edge */}
        <image
          href={symbolMark}
          x="500"
          y="-40"
          width="280"
          height="280"
          opacity="0.22"
          transform="rotate(8 640 100)"
          filter="url(#symbolHeroWhiteify)"
        />

        {/* Broadcast ripples behind the badge, echoing the send action */}
        <circle className="symbol-hero-ripple" cx="106" cy="100" r="58" fill="none" stroke="#FFFFFF" strokeOpacity="0.4" strokeWidth="2" />
        <circle className="symbol-hero-ripple" cx="106" cy="100" r="58" fill="none" stroke="#FFFFFF" strokeOpacity="0.4" strokeWidth="2" style={{ animationDelay: '1.8s' }} />

        {/* Crisp foreground badge: soft plate + white silhouette of the Symbol mark */}
        <circle cx="106" cy="100" r="56" fill="#FFFFFF" fillOpacity="0.14" />
        <image
          href={symbolMark}
          x="62"
          y="56"
          width="88"
          height="88"
          filter="url(#symbolHeroWhiteify)"
        />

        {/* Paper airplane, carrying the transaction from the badge out toward the network */}
        <g className="symbol-hero-plane">
          <path
            d="M330 132 L392 76 L358 90 L352 122 L342 104 Z"
            fill="#FFFFFF"
            fillOpacity="0.94"
          />
          <path d="M358 90 L392 76 L342 104" fill="none" stroke="#552590" strokeOpacity="0.35" strokeWidth="1.5" />
          {/* Motion trail, behind the tail, opposite the direction of travel */}
          <path d="M296 146 L272 158 M304 132 L278 142 M312 120 L288 128" stroke="#FFFFFF" strokeOpacity="0.5" strokeWidth="2" strokeLinecap="round" />
        </g>
      </svg>
    </Box>
  );
}
