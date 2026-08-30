import { useEffect, useState } from 'react';
import { Box, Typography } from '@mui/material';
import { QRCodeSVG } from 'qrcode.react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import AppToolBar from '../../components/AppToolBar';
import WalletBar from '../../components/WalletBar';
import { WalletsHelper } from '../../lib/storage';
import heroSendSmall from '../../assets/heroimage_send_small.png';

export default function WalletAddress() {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const id = searchParams.get('id') || '';
  const [address, setAddress] = useState('');

  useEffect(() => {
    (async () => {
      const activeWallet = await WalletsHelper.getActive();
      setAddress(activeWallet?.address ?? '');
    })();
  }, []);

  return (
    <Box>
      <AppToolBar back={`/wallet/settings?id=${id}`} title={t('common.address')} />
      <Box sx={{ display: 'flex', flexDirection: 'column' }}>
        <WalletBar isOpened={false} id={id} showIcon={false} />
        <Box component="img" src={heroSendSmall} sx={{ width: '100%' }} />

        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', mt: 2 }}>
          {address.length > 0 && <QRCodeSVG value={address} size={200} />}
          <Typography sx={{ mt: 4, color: 'primary.main' }}>Your Address</Typography>
          <Typography align="center" sx={{ wordBreak: 'break-all', mx: 4 }}>{address}</Typography>
        </Box>
      </Box>
    </Box>
  );
}
