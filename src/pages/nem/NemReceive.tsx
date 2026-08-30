import { useEffect, useState } from 'react';
import { Box, Typography, IconButton } from '@mui/material';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import { QRCodeSVG } from 'qrcode.react';
import AppToolBar from '../../components/AppToolBar';
import WalletBar from '../../components/WalletBar';
import MessageDialog from '../../components/MessageDialog';
import NemReceiveHero from '../../components/NemReceiveHero';
import raccoonIcon from '../../assets/logo_raccoon_icon.png';
import { WalletsHelper } from '../../lib/storage';
import { buildAddressQrPayload } from '../../lib/nemQr';

// NEM's brand blue - the same swatch used across the NEM section (balance card gradient
// in NemTop.tsx, NemReceiveHero, and NemSend.tsx) so this screen reads consistently with
// the rest of NEM rather than the app's default teal primary color.
const NEM_BLUE = '#2F7FCC';
const NEM_BLUE_SOFT = '#EAF3FC';

export default function NemReceive() {
  const [address, setAddress] = useState('');
  const [walletName, setWalletName] = useState('Raccoon Wallet');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    (async () => {
      const activeWallet = await WalletsHelper.getActive();
      setAddress(activeWallet?.nemAddress ?? '');
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
      <AppToolBar back="/nem" title="Receive" backColor={NEM_BLUE} />
      <WalletBar isOpened={false} />
      <NemReceiveHero />

      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', mt: 3, px: 3 }}>
        <Box
          sx={{
            width: '100%',
            maxWidth: 320,
            borderRadius: 4,
            border: `1.5px solid ${NEM_BLUE}`,
            overflow: 'hidden',
            bgcolor: 'white',
          }}
        >
          <Box sx={{
            bgcolor: NEM_BLUE_SOFT, py: 1.25, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1,
          }}
          >
            <Box component="img" src={raccoonIcon} sx={{ width: 22, height: 22, objectFit: 'contain' }} />
            <Typography sx={{ color: NEM_BLUE, fontWeight: 'bold', fontSize: 16 }}>
              {walletName}
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
            {address.length > 0 && <QRCodeSVG value={buildAddressQrPayload(walletName, address)} size={200} />}
          </Box>
        </Box>

        <Typography sx={{ mt: 3, color: NEM_BLUE }}>Your NEM address</Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mx: 2 }}>
          <Typography align="center" sx={{ wordBreak: 'break-all' }}>{address}</Typography>
          <IconButton size="small" onClick={onCopy} aria-label="Copy address" sx={{ color: NEM_BLUE }}>
            <ContentCopyIcon fontSize="inherit" />
          </IconButton>
        </Box>
        <Typography sx={{ mt: 2, color: 'text.secondary', fontSize: 12, mx: 2, textAlign: 'center' }}>
          このアドレスはXEM(NEM)専用です。他のチェーンの資産を送らないでください。
        </Typography>
      </Box>

      <MessageDialog
        open={copied}
        title="Copied"
        texts={['Your NEM address has been copied to the clipboard.']}
        onClose={() => setCopied(false)}
      />
    </Box>
  );
}
