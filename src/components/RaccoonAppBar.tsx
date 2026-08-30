import { useState } from 'react';
import { AppBar, Toolbar, Box, IconButton } from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import { useNavigate } from 'react-router-dom';
import NavigationDrawer from './NavigationDrawer';
import logoRaccoonIcon from '../assets/logo_raccoon_icon.png';
import logoRaccoonWordmark from '../assets/logo_raccoon_wordmark.png';

// Shared top bar for the bottom-nav screens (Home / Token / Swap): the Raccoon icon +
// wordmark + hamburger menu, in place of a per-screen title/back arrow. These screens
// each sit at the top of their own navigation stack, so a title+back bar (see
// AppToolBar) doesn't apply here - this is the common header instead. Ported out of
// pages/top/Top.tsx so Balance and SwapTop can share the exact same header.
export default function RaccoonAppBar() {
  const navigate = useNavigate();
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <>
      <AppBar position="sticky" color="default" elevation={1}>
        <Toolbar sx={{ position: 'relative' }}>
          <IconButton
            onClick={() => navigate('/top?tab=home', { replace: true })}
            aria-label="home"
            sx={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', p: 0.5 }}
          >
            <Box component="img" src={logoRaccoonIcon} alt="" sx={{ height: 36, display: 'block' }} />
          </IconButton>
          <Box sx={{ flexGrow: 1 }} />
          <Box component="img" src={logoRaccoonWordmark} alt="Raccoon Wallet" sx={{ height: 20 }} />
          <Box sx={{ flexGrow: 1 }} />
          <IconButton onClick={() => setDrawerOpen(true)} aria-label="menu">
            <MenuIcon />
          </IconButton>
        </Toolbar>
      </AppBar>

      <NavigationDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />
    </>
  );
}
