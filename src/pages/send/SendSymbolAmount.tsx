import { useEffect, useState } from 'react';
import { Box, Typography } from '@mui/material';
import AppToolBar from '../../components/AppToolBar';
import WalletBar from '../../components/WalletBar';
import Calculator from '../../components/Calculator';
import SymbolHero from '../../components/SymbolHero';
import { WalletsHelper } from '../../lib/storage';
import { fetchSymbolBalance } from '../../lib/symbolChain';
import { useAppStore } from '../../store/appStore';

const SYMBOL_VIOLET = '#8239DD';

function truncateAddress(address: string): string {
  const groups = address.match(/.{1,6}/g) ?? [address];
  return groups.join('-');
}

/**
 * Amount-entry (numpad) screen for a Symbol send started from the Home Send screen (see
 * pages/top/Send.tsx): when the address the person typed there is a valid Symbol address
 * and this wallet has derived its Symbol account before, they land here instead of the
 * EVM/JPYC SendAmount screen - same numpad interaction, but scoped to XYM only (Symbol has
 * no chain/token picker). Once they hit the calculator's "→", SymbolSend picks the
 * receiverAddress/calculatorFormula this screen wrote to the store back up (see its
 * `fromHome` handling) to pre-fill its own form.
 */
export default function SendSymbolAmount() {
  const calculatorFormula = useAppStore((s) => s.calculatorFormula);
  const receiverAddress = useAppStore((s) => s.receiverAddress);
  const [balance, setBalance] = useState('0');

  useEffect(() => {
    (async () => {
      const activeWallet = await WalletsHelper.getActive();
      if (!activeWallet?.symbolAddress) return;
      const b = await fetchSymbolBalance(activeWallet.symbolAddress);
      setBalance(b);
    })();
  }, []);

  return (
    <Box sx={{ height: '100%' }}>
      <AppToolBar back="/top?tab=send" title="Specify amount" backColor={SYMBOL_VIOLET} />
      <WalletBar isOpened={false} />
      <Box sx={{ display: 'flex', flexDirection: 'column' }}>
        <SymbolHero />

        <Box sx={{ px: 2, mt: 1 }}>
          <Typography sx={{ color: SYMBOL_VIOLET, fontSize: 13 }}>Recipient address</Typography>
          <Typography sx={{ fontSize: 13, wordBreak: 'break-all' }}>
            {truncateAddress(receiverAddress)}
          </Typography>
        </Box>

        <Box sx={{ px: 2, mt: 2 }}>
          <Typography sx={{ color: SYMBOL_VIOLET }}>Amount</Typography>
          <Typography sx={{ fontSize: 'x-large' }}>{calculatorFormula} XYM</Typography>
          <Typography sx={{ color: '#929292', fontSize: 12 }}>
            利用可能残高: {balance} XYM
          </Typography>
        </Box>
      </Box>
      <Box sx={{ position: 'sticky', bottom: 0 }}>
        <Calculator to="/symbol/send?fromHome=1" />
      </Box>
    </Box>
  );
}
