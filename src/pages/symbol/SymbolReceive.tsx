import { useEffect, useState } from 'react';
import { Box, Typography, IconButton } from '@mui/material';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import { QRCodeSVG } from 'qrcode.react';
import AppToolBar from '../../components/AppToolBar';
import WalletBar from '../../components/WalletBar';
import MessageDialog from '../../components/MessageDialog';
import SymbolReceiveHero from '../../components/SymbolReceiveHero';
import raccoonIcon from '../../assets/logo_raccoon_icon.png';
import { WalletsHelper } from '../../lib/storage';
import { buildAddressQrPayload } from '../../lib/symbolQr';

// Symbol's brand violet - the same swatch used across the Symbol section (balance card
// gradient in SymbolTop.tsx, SymbolReceiveHero, and SymbolSend.tsx) so this screen reads
// consistently with the rest of Symbol rather than the app's default teal primary color.
const SYMBOL_VIOLET = '#8239DD';
const SYMBOL_VIOLET_SOFT = '#F4EBFD';

// Original card design for this screen, built from Racoon Wallet's own identity (the
// violet brand color + the app's raccoon mark) rather than the earlier "Symbol Wallet"
// card, which copied the look of a generic third-party wallet's QR export screen. A thin
// violet border and a soft violet header tie the card to the rest of this Symbol section;
// the raccoon icon in the header signs it as "this app's" QR, not a borrowed screenshot.

export default function SymbolReceive() {
  const [address, setAddress] = useState('');
  const [walletName, setWalletName] = useState('Raccoon Wallet');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    (async () => {
      const activeWallet = await WalletsHelper.getActive();
      setAddress(activeWallet?.symbolAddress ?? '');
      if (activeWallet?.name) setWalletName(activeWallet.name);
    })();
  }, []);

  const onCopy = async () => {
    if (!address) return;
    await navigator.clipboard.writeText(address);
    setCopied(true);
  };

  return (
    <Box>
      <AppToolBar back="/symbol" title="Receive" backColor={SYMBOL_VIOLET} />
      <WalletBar isOpened={false} />
      <SymbolReceiveHero />

      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', mt: 3, px: 3 }}>
        <Box
          sx={{
            width: '100%',
            maxWidth: 320,
            borderRadius: 4,
            border: `1.5px solid ${SYMBOL_VIOLET}`,
            overflow: 'hidden',
            bgcolor: 'white',
          }}
        >
          <Box sx={{
            bgcolor: SYMBOL_VIOLET_SOFT, py: 1.25, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1,
          }}
          >
            <Box component="img" src={raccoonIcon} sx={{ width: 22, height: 22, objectFit: 'contain' }} />
            <Typography sx={{ color: SYMBOL_VIOLET, fontWeight: 'bold', fontSize: 16 }}>
              {walletName}
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
            {address.length > 0 && <QRCodeSVG value={buildAddressQrPayload(walletName, address)} size={200} />}
          </Box>
        </Box>

        <Typography sx={{ mt: 3, color: SYMBOL_VIOLET }}>Your Symbol address</Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mx: 2 }}>
          <Typography align="center" sx={{ wordBreak: 'break-all' }}>{address}</Typography>
          <IconButton size="small" onClick={onCopy} aria-label="Copy address" sx={{ color: SYMBOL_VIOLET }}>
            <ContentCopyIcon fontSize="inherit" />
          </IconButton>
        </Box>
        <Typography sx={{ mt: 2, color: 'text.secondary', fontSize: 12, mx: 2, textAlign: 'center' }}>
          このアドレスはXYM(Symbol)専用です。他のチェーンの資産を送らないでください。
        </Typography>
      </Box>

      <MessageDialog
        open={copied}
        title="Copied"
        texts={['Your Symbol address has been copied to the clipboard.']}
        onClose={() => setCopied(false)}
      />
    </Box>
  );
}
