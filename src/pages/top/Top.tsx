import { useEffect, useState } from 'react';
import { Box } from '@mui/material';
import { useSearchParams } from 'react-router-dom';
import RaccoonAppBar from '../../components/RaccoonAppBar';
import WalletBar from '../../components/WalletBar';
import BottomNav from '../../components/BottomNav';
import QRLab from './QRLab';
import Receive from './Receive';
import Home from './Home';
import Send from './Send';
import Scan from './Scan';

type TabKey = 'qrlab' | 'receive' | 'home' | 'send' | 'scan';

// Ported from src/components/pages/top/Top.vue. Vuetify's v-tabs-items kept every tab's
// component mounted (just hidden) so state like the in-progress Send address wasn't lost
// when switching tabs; this keeps that same behavior by rendering every tab and toggling
// visibility with `display`, rather than conditionally mounting only the active one.
export default function Top() {
  const [searchParams] = useSearchParams();
  const [displayTab, setDisplayTab] = useState<TabKey>('home');

  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab && ['qrlab', 'receive', 'home', 'send', 'scan'].includes(tab)) {
      setDisplayTab(tab as TabKey);
    }
  }, [searchParams]);

  return (
    <Box sx={{ minHeight: '100vh' }}>
      <RaccoonAppBar />

      <Box sx={{ minHeight: '100vh', pb: 7 }}>
        <WalletBar isOpened={false} />
        <Box sx={{ display: displayTab === 'qrlab' ? 'block' : 'none' }}><QRLab /></Box>
        <Box sx={{ display: displayTab === 'receive' ? 'block' : 'none' }}><Receive /></Box>
        <Box sx={{ display: displayTab === 'home' ? 'block' : 'none' }}><Home needsUpdate={displayTab === 'home'} /></Box>
        <Box sx={{ display: displayTab === 'send' ? 'block' : 'none' }}><Send /></Box>
        <Box sx={{ display: displayTab === 'scan' ? 'block' : 'none' }}><Scan isActive={displayTab === 'scan'} /></Box>
      </Box>

      <BottomNav active={displayTab === 'qrlab' ? 'qrlab' : 'home'} />
    </Box>
  );
}
