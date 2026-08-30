import { useEffect, useState, useCallback } from 'react';
import { Box, IconButton, Typography } from '@mui/material';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Environment } from '../lib/environment';
import { WalletsHelper } from '../lib/storage';
import { useAppStore } from '../store/appStore';
import walletBarBg from '../assets/image_walletbar.png';
import iconWallet from '../assets/icon_wallet.png';
import iconWalletBack from '../assets/icon_wallet_back.png';

interface WalletBarProps {
  isOpened: boolean;
  id?: string;
  showIcon?: boolean;
  // Bumping this triggers a re-fetch of the wallet name (mirrors the Vue version's
  // `value`/`input` v-model pattern used to signal "the active wallet changed").
  refreshKey?: number;
}

// Ported from src/components/parts/WalletBar.vue.
export default function WalletBar({ isOpened, id = '', showIcon = true, refreshKey = 0 }: WalletBarProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation();
  const backPathFromWalletSelect = useAppStore((s) => s.backPathFromWalletSelect);
  const setBackPathFromWalletSelect = useAppStore((s) => s.setBackPathFromWalletSelect);
  const [walletName, setWalletName] = useState('');

  const getTargetWallet = useCallback(async () => {
    return id.length === 0 ? await WalletsHelper.getActive() : await WalletsHelper.get(id);
  }, [id]);

  const refresh = useCallback(async () => {
    const wallet = await getTargetWallet();
    setWalletName(wallet === null ? t('common.not_select') : wallet.name);
  }, [getTargetWallet, t]);

  useEffect(() => {
    refresh();
  }, [refresh, refreshKey]);

  const onClickWallet = () => {
    if (isOpened) {
      if (Environment.isIos() && Environment.isInStandaloneMode()) {
        navigate(backPathFromWalletSelect);
      } else {
        navigate(-1);
      }
    } else {
      setBackPathFromWalletSelect(location.pathname + location.search);
      navigate('/wallet/select');
    }
  };

  return (
    <Box
      sx={{
        zIndex: 1,
        position: 'fixed',
        width: '100%',
        height: 48,
        // Pin explicitly to just below the AppBar's Toolbar (56px on mobile, 64px on
        // desktop, per MUI's default Toolbar minHeight), overlapping its bottom edge by
        // 4px. Relying on the browser to compute this via an unset `top` (the CSS "static
        // position" for fixed elements) was unreliable here — it produced a visible gap
        // under the AppBar and let the notch drift when the page scrolled instead of
        // staying pinned. An explicit `top` is fixed relative to the viewport by
        // definition, so it can never do either.
        top: { xs: '52px', sm: '60px' },
      }}
    >
      <Box
        onClick={showIcon ? onClickWallet : undefined}
        sx={{
          position: 'absolute', inset: 0, m: 'auto', width: '70%', maxWidth: 300, height: '100%',
          cursor: showIcon ? 'pointer' : 'default',
        }}
      >
        <Box component="img" src={walletBarBg} sx={{ position: 'absolute', inset: 0, m: 'auto', width: '100%' }} />
        {showIcon && (
          <IconButton
            size="small"
            color="primary"
            onClick={onClickWallet}
            sx={{ position: 'absolute', top: 0, bottom: 0, right: 32, m: 'auto', zIndex: 2 }}
          >
            <Box component="img" src={isOpened ? iconWalletBack : iconWallet} sx={{ width: 16 }} />
          </IconButton>
        )}
        <Typography sx={{ position: 'absolute', textAlign: 'center', inset: 0, m: 'auto', height: '50%' }}>
          {walletName}
        </Typography>
      </Box>
    </Box>
  );
}
