import { Box } from '@mui/material';
import nemMark from '../assets/icon_home_nem_blue.png';

/**
 * NEM (XEM) branded hero banner, mirroring components/SymbolHero.tsx exactly (same
 * node-lattice texture, badge + watermark + departing-paper-airplane layout) but using
 * NEM's own tri-color mark (orange/blue/teal, sampled from all three petals of the
 * official NEM logo - see assets/NEM_WC_Logo_200px.png) instead of Symbol's violet, so
 * the two chains' Send screens read as distinct sections rather than palette-swapped
 * copies of each other.
 */
export default function NemHero() {
  return (
    <Box
      sx={{
        width: '100%',
        lineHeight: 0,
        '& .nem-hero-plane': {
          transformBox: 'fill-box',
          transformOrigin: '50% 50%',
          animation: 'nemHeroPlaneDrift 6s ease-in-out infinite',
        },
        '& .nem-hero-ripple': {
          transformBox: 'fill-box',
          transformOrigin: '50% 50%',
          animation: 'nemHeroRipple 3.6s ease-out infinite',
        },
        '@media (prefers-reduced-motion: reduce)': {
          '& .nem-hero-plane, & .nem-hero-ripple': { animation: 'none' },
        },
        '@keyframes nemHeroPlaneDrift': {
          '0%, 100%': { transform: 'translate(0px, 0px)' },
          '50%': { transform: 'translate(10px, -8px)' },
        },
        '@keyframes nemHeroRipple': {
          '0%': { transform: 'scale(0.75)', opacity: 0.35 },
          '100%': { transform: 'scale(1.35)', opacity: 0 },
        },
      }}
    >
      <svg viewBox="0 0 720 200" width="100%" height="auto" role="img" aria-label="NEM">
        <defs>
          <linearGradient id="nemHeroBg" x1="0" y1="0" x2="720" y2="200" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#F28600" />
            <stop offset="50%" stopColor="#2A85DF" />
            <stop offset="100%" stopColor="#0FBCAB" />
          </linearGradient>
          <pattern id="nemHeroLattice" width="50" height="50" patternUnits="userSpaceOnUse">
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
              alpha channel, so it reads cleanly against the blue background below. */}
          <filter id="nemHeroWhiteify" x="-20%" y="-20%" width="140%" height="140%">
            <feColorMatrix type="matrix" values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 1 0" />
          </filter>
        </defs>

        <rect width="720" height="200" fill="url(#nemHeroBg)" />
        <rect width="720" height="200" fill="url(#nemHeroLattice)" />

        {/* Large tonal watermark of the NEM mark, bleeding off the right edge */}
        <image
          href={nemMark}
          x="500"
          y="-40"
          width="280"
          height="280"
          opacity="0.22"
          transform="rotate(8 640 100)"
          filter="url(#nemHeroWhiteify)"
        />

        {/* Broadcast ripples behind the badge, echoing the send action */}
        <circle className="nem-hero-ripple" cx="106" cy="100" r="58" fill="none" stroke="#FFFFFF" strokeOpacity="0.4" strokeWidth="2" />
        <circle className="nem-hero-ripple" cx="106" cy="100" r="58" fill="none" stroke="#FFFFFF" strokeOpacity="0.4" strokeWidth="2" style={{ animationDelay: '1.8s' }} />

        {/* Crisp foreground badge: soft plate + white silhouette of the NEM mark */}
        <circle cx="106" cy="100" r="56" fill="#FFFFFF" fillOpacity="0.14" />
        <image
          href={nemMark}
          x="62"
          y="56"
          width="88"
          height="88"
          filter="url(#nemHeroWhiteify)"
        />

        {/* Paper airplane, carrying the transaction from the badge out toward the network */}
        <g className="nem-hero-plane">
          <path
            d="M330 132 L392 76 L358 90 L352 122 L342 104 Z"
            fill="#FFFFFF"
            fillOpacity="0.94"
          />
          <path d="M358 90 L392 76 L342 104" fill="none" stroke="#0FBCAB" strokeOpacity="0.35" strokeWidth="1.5" />
          {/* Motion trail, behind the tail, opposite the direction of travel */}
          <path d="M296 146 L272 158 M304 132 L278 142 M312 120 L288 128" stroke="#FFFFFF" strokeOpacity="0.5" strokeWidth="2" strokeLinecap="round" />
        </g>
      </svg>
    </Box>
  );
}
