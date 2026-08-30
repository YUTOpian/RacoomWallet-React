import { Box, BottomNavigation, BottomNavigationAction } from '@mui/material';
import SwapHorizOutlinedIcon from '@mui/icons-material/SwapHorizOutlined';
import ListAltOutlinedIcon from '@mui/icons-material/ListAltOutlined';
import ContactsOutlinedIcon from '@mui/icons-material/ContactsOutlined';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import iconQrLab from '../assets/icon_home_qr_labo_green.png';
import iconHome from '../assets/icon_home_home_green.png';

export type BottomNavKey = 'qrlab' | 'swap' | 'home' | 'token' | 'addressbook';

// Which item is highlighted. Home's own in-page tabs (receive/send/scan) don't have a
// bottom-nav slot of their own - callers on those tabs should pass 'home'.
interface BottomNavProps {
  active: BottomNavKey;
}

const iconSx = { height: 26 };

// MUI's BottomNavigationAction bumps the selected label's font-size up (0.75rem ->
// 0.875rem via theme.typography) by default. On narrow phone screens that growth is
// enough to wrap longer labels like "トークン"/"TOKEN" onto two lines, which looks broken
// since every other tab's label stays on one line. Locking both selected and unselected
// labels to the same size keeps the whole bar visually stable regardless of which tab is
// active, and nowrap is a safety net against wrapping from font-size differences alone.
const labelSx = {
  '& .MuiBottomNavigationAction-label': {
    fontSize: '0.65rem',
    whiteSpace: 'nowrap',
    '&.Mui-selected': { fontSize: '0.65rem' },
  },
};

type NavItem =
  | { kind: 'tab'; key: 'qrlab' | 'home'; label: string; icon: React.ReactNode; path: string }
  | { kind: 'route'; key: 'swap' | 'token' | 'addressbook'; label: string; icon: React.ReactNode; path: string };

// Shared across Top.tsx (where 'qrlab'/'home' are in-page tabs and 'swap'/'token' just
// navigate away) and SwapTop.tsx/Balance.tsx/AddressBook.tsx (which are full-page routes
// reached from Top's 'swap'/'token'/'addressbook' slots, and need the exact same bar so those
// screens aren't dead ends reachable only via the toolbar's back arrow).
export default function BottomNav({ active }: BottomNavProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();

  // Built inside the component (rather than as a module-level constant) so the labels
  // re-render immediately when the app's language setting changes.
  const navItems: NavItem[] = [
    { kind: 'tab', key: 'qrlab', label: t('home.nav_qrlab'), path: '/top?tab=qrlab', icon: <Box component="img" src={iconQrLab} sx={iconSx} /> },
    { kind: 'route', key: 'swap', label: t('home.nav_swap'), path: '/swap', icon: <SwapHorizOutlinedIcon sx={{ fontSize: 26 }} /> },
    { kind: 'tab', key: 'home', label: t('home.nav_home'), path: '/top?tab=home', icon: <Box component="img" src={iconHome} sx={iconSx} /> },
    { kind: 'route', key: 'token', label: t('home.nav_token'), path: '/balance', icon: <ListAltOutlinedIcon sx={{ fontSize: 26 }} /> },
    {
      kind: 'route',
      key: 'addressbook',
      label: t('home.nav_address'),
      path: '/addressbook',
      icon: <ContactsOutlinedIcon sx={{ fontSize: 26 }} />,
    },
  ];

  return (
    <BottomNavigation
      value={active}
      showLabels
      sx={{ position: 'fixed', bottom: 0, left: 0, right: 0, px: 1, py: 0.5 }}
    >
      {navItems.map((item) => {
        const isActive = item.key === active;
        return (
          <BottomNavigationAction
            key={item.key}
            label={item.label}
            value={item.key}
            onClick={() => navigate(item.path, { replace: true })}
            icon={<Box sx={{ filter: isActive ? 'none' : 'grayscale(100%) opacity(0.5)' }}>{item.icon}</Box>}
            sx={{
              minWidth: 0,
              mx: 0.5,
              borderRadius: 999,
              color: isActive ? 'primary.main' : 'text.disabled',
              bgcolor: isActive ? 'rgba(0, 195, 178, 0.1)' : 'transparent',
              ...labelSx,
            }}
          />
        );
      })}
    </BottomNavigation>
  );
}
