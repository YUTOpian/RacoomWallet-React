import { Box } from '@mui/material';
import nemMark from '../assets/icon_home_nem_blue.png';

/**
 * NEM (XEM) branded hero banner for the Receive screen, mirroring
 * components/SymbolReceiveHero.tsx exactly (mirrored badge/watermark layout, inflowing
 * chevrons, contracting rings) in NEM's brand blue instead of Symbol's violet - see
 * components/NemHero.tsx for why.
 */
export default function NemReceiveHero() {
  return (
    <Box
      sx={{
        width: '100%',
        lineHeight: 0,
        '& .nem-receive-hero-chevrons': {
          transformBox: 'fill-box',
          transformOrigin: '50% 50%',
          animation: 'nemReceiveHeroInflow 1.8s ease-in-out infinite',
        },
        '& .nem-receive-hero-ring': {
          transformBox: 'fill-box',
          transformOrigin: '50% 50%',
          animation: 'nemReceiveHeroContract 3.6s ease-out infinite',
        },
        '@media (prefers-reduced-motion: reduce)': {
          '& .nem-receive-hero-chevrons, & .nem-receive-hero-ring': { animation: 'none' },
        },
        '@keyframes nemReceiveHeroInflow': {
          '0%, 100%': { transform: 'translateX(0px)', opacity: 0.9 },
          '50%': { transform: 'translateX(10px)', opacity: 0.4 },
        },
        '@keyframes nemReceiveHeroContract': {
          '0%': { transform: 'scale(1.35)', opacity: 0 },
          '70%': { opacity: 0.4 },
          '100%': { transform: 'scale(0.75)', opacity: 0.35 },
        },
      }}
    >
      <svg viewBox="0 0 720 200" width="100%" height="auto" role="img" aria-label="NEM Receive">
        <defs>
          <linearGradient id="nemReceiveHeroBg" x1="720" y1="0" x2="0" y2="200" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#F28600" />
            <stop offset="50%" stopColor="#2A85DF" />
            <stop offset="100%" stopColor="#0FBCAB" />
          </linearGradient>
          <pattern id="nemReceiveHeroLattice" width="50" height="50" patternUnits="userSpaceOnUse">
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
          <filter id="nemReceiveHeroWhiteify" x="-20%" y="-20%" width="140%" height="140%">
            <feColorMatrix type="matrix" values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 1 0" />
          </filter>
        </defs>

        <rect width="720" height="200" fill="url(#nemReceiveHeroBg)" />
        <rect width="720" height="200" fill="url(#nemReceiveHeroLattice)" />

        <image
          href={nemMark}
          x="-60"
          y="-40"
          width="280"
          height="280"
          opacity="0.22"
          transform="rotate(-8 80 100)"
          filter="url(#nemReceiveHeroWhiteify)"
        />

        <circle className="nem-receive-hero-ring" cx="614" cy="100" r="58" fill="none" stroke="#FFFFFF" strokeOpacity="0.4" strokeWidth="2" />
        <circle className="nem-receive-hero-ring" cx="614" cy="100" r="58" fill="none" stroke="#FFFFFF" strokeOpacity="0.4" strokeWidth="2" style={{ animationDelay: '1.8s' }} />

        <circle cx="614" cy="100" r="56" fill="#FFFFFF" fillOpacity="0.14" />
        <image
          href={nemMark}
          x="570"
          y="56"
          width="88"
          height="88"
          filter="url(#nemReceiveHeroWhiteify)"
        />

        <g className="nem-receive-hero-chevrons">
          <path d="M330 78 L360 100 L330 122" fill="none" stroke="#FFFFFF" strokeOpacity="0.85" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M380 78 L410 100 L380 122" fill="none" stroke="#FFFFFF" strokeOpacity="0.55" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M430 78 L460 100 L430 122" fill="none" stroke="#FFFFFF" strokeOpacity="0.3" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
        </g>
      </svg>
    </Box>
  );
}
