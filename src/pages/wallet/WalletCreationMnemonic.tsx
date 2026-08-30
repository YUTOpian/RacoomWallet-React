import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Box, Grid, Card, Typography, Checkbox, FormControlLabel, Button } from '@mui/material';
import { useTranslation } from 'react-i18next';
import AppToolBar from '../../components/AppToolBar';
import PinDialog from '../../components/PinDialog';
import { PinCodeHelper, WalletsHelper } from '../../lib/storage';
import cautionIcon from '../../assets/icon_caution.png';

export default function WalletCreationMnemonic() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const id = searchParams.get('id') || '';

  const [mnemonic, setMnemonic] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [showPinDialog, setShowPinDialog] = useState(false);

  const getWallet = async () => {
    return id.length === 0 ? await WalletsHelper.getActive() : await WalletsHelper.get(id);
  };

  useEffect(() => {
    (async () => {
      const wallet = await getWallet();
      if (wallet == null) {
        setMnemonic('');
        return;
      }
      // Try the default PIN first regardless of whether a custom PIN has been set
      // elsewhere — the "quick add" flow (reusing an earlier wallet's recovery phrase)
      // always encrypts with the default PIN, so this avoids an unnecessary prompt for
      // wallets created that way. Only fall back to asking for a custom PIN if that fails.
      const defaultDecrypted = await wallet.decryptMnemonic(PinCodeHelper.defaultPin);
      if (defaultDecrypted != null) {
        setMnemonic(defaultDecrypted);
      } else {
        setShowPinDialog(true);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const onPassed = async (pin: string) => {
    const wallet = await getWallet();
    if (wallet != null) {
      setMnemonic((await wallet.decryptMnemonic(pin)) || '');
    }
  };

  const words = mnemonic.length === 0 ? [] : mnemonic.split(' ');

  return (
    <div>
      <AppToolBar title={t('wallet.mnemonic_title')} />
      <Box sx={{ mb: 5 }}>
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', mt: 2, gap: 1 }}>
          <Box component="img" src={cautionIcon} sx={{ width: 16, height: 16 }} />
          <span>{t('wallet.mnemonic_caution_title')}</span>
        </Box>

        <Typography align="center" sx={{ mt: 2, mx: 2 }}>{t('wallet.mnemonic_caution_message')}</Typography>

        <Grid container spacing={0.5} sx={{ justifyContent: 'center', mt: 3, px: 2 }}>
          {words.map((word, index) => (
            <Grid key={index} size={4} sx={{ p: 0.5 }}>
              <Card variant="outlined" sx={{ bgcolor: 'grey.100', p: 1 }}>
                <Typography component="span" sx={{ color: 'text.secondary', fontSize: 12 }}>{index + 1}</Typography>
                <Typography component="span" sx={{ ml: 0.5 }}>{word}</Typography>
              </Card>
            </Grid>
          ))}
        </Grid>

        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 3 }}>
          <FormControlLabel
            control={<Checkbox checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} />}
            label={t('wallet.mnemonic_confirm_checkbox')}
          />
        </Box>
      </Box>

      <Box sx={{ position: 'sticky', bottom: 0, bgcolor: 'background.paper', display: 'flex', flexDirection: 'column', alignItems: 'center', py: 2 }}>
        <Button variant="contained" color="primary" size="small" disabled={!confirmed} onClick={() => navigate('/wallet/creation/new')}>
          {t('common.done')}
        </Button>
      </Box>

      <PinDialog open={showPinDialog} mode="check" onClose={() => setShowPinDialog(false)} onPass={onPassed} />
    </div>
  );
}
