import { useEffect, useState } from 'react';
import { Box, Typography } from '@mui/material';
import AppToolBar from '../../components/AppToolBar';
import WalletBar from '../../components/WalletBar';
import Calculator from '../../components/Calculator';
import NemHero from '../../components/NemHero';
import { WalletsHelper } from '../../lib/storage';
import { fetchNemBalance } from '../../lib/nemChain';
import { useAppStore } from '../../store/appStore';

const NEM_BLUE = '#2F7FCC';

function truncateAddress(address: string): string {
  const groups = address.match(/.{1,6}/g) ?? [address];
  return groups.join('-');
}

/**
 * Amount-entry (numpad) screen for a NEM send started from the Home Send screen (see
 * pages/top/Send.tsx): when the address the person typed there is a valid NEM address and
 * this wallet has derived its NEM account before, they land here instead of the EVM/JPYC
 * SendAmount screen - same numpad interaction, but scoped to XEM only (NEM has no chain/
 * token picker). Once they hit the calculator's "→", NemSend picks the receiverAddress/
 * calculatorFormula this screen wrote to the store back up (see its `fromHome` handling)
 * to pre-fill its own form.
 */
export default function SendNemAmount() {
  const calculatorFormula = useAppStore((s) => s.calculatorFormula);
  const receiverAddress = useAppStore((s) => s.receiverAddress);
  const [balance, setBalance] = useState('0');

  useEffect(() => {
    (async () => {
      const activeWallet = await WalletsHelper.getActive();
      if (!activeWallet?.nemAddress) return;
      const b = await fetchNemBalance(activeWallet.nemAddress);
      setBalance(b);
    })();
  }, []);

  return (
    <Box sx={{ height: '100%' }}>
      <AppToolBar back="/top?tab=send" title="Specify amount" backColor={NEM_BLUE} />
      <WalletBar isOpened={false} />
      <Box sx={{ display: 'flex', flexDirection: 'column' }}>
        <NemHero />

        <Box sx={{ px: 2, mt: 1 }}>
          <Typography sx={{ color: NEM_BLUE, fontSize: 13 }}>Recipient address</Typography>
          <Typography sx={{ fontSize: 13, wordBreak: 'break-all' }}>
            {truncateAddress(receiverAddress)}
          </Typography>
        </Box>

        <Box sx={{ px: 2, mt: 2 }}>
          <Typography sx={{ color: NEM_BLUE }}>Amount</Typography>
          <Typography sx={{ fontSize: 'x-large' }}>{calculatorFormula} XEM</Typography>
          <Typography sx={{ color: '#929292', fontSize: 12 }}>
            利用可能残高: {balance} XEM
          </Typography>
        </Box>
      </Box>
      <Box sx={{ position: 'sticky', bottom: 0 }}>
        <Calculator to="/nem/send?fromHome=1" />
      </Box>
    </Box>
  );
}
