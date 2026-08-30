import { useState } from 'react';
import { Box, Button, Typography } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import AppToolBar from '../../components/AppToolBar';
import MessageDialog from '../../components/MessageDialog';
import heroLoginLarge from '../../assets/heroimage_login_large.png';

export default function WalletLoginEnd() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [showCaution1, setShowCaution1] = useState(false);
  const [showCaution2, setShowCaution2] = useState(false);

  return (
    <div>
      <AppToolBar back="/wallet/login/name" title={t('wallet.login_end_title')} />
      <Box component="img" src={heroLoginLarge} sx={{ width: '100%' }} />
      <Box sx={{ px: 2 }}>
        <Typography align="center" sx={{ mx: 2 }}>
          {(t('wallet.login_end_message', { returnObjects: true }) as string[]).map((line, i) => (
            <span key={i}>{line}<br /></span>
          ))}
        </Typography>

        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', mt: 2, gap: 1 }}>
          <Button variant="contained" sx={{ bgcolor: 'grey.600', color: 'white' }} onClick={() => setShowCaution1(true)}>
            HOME
          </Button>
        </Box>
      </Box>

      <MessageDialog
        open={showCaution1}
        title={t('wallet.go_home_caution1_title')}
        texts={t('wallet.go_home_caution1_message', { returnObjects: true }) as string[]}
        selectable
        onClose={() => { setShowCaution1(false); setShowCaution2(true); }}
        onCancel={() => setShowCaution1(false)}
      />
      <MessageDialog
        open={showCaution2}
        title={t('wallet.go_home_caution2_title')}
        texts={t('wallet.go_home_caution2_message', { returnObjects: true }) as string[]}
        selectable
        onClose={() => navigate('/top?tab=home')}
        onCancel={() => setShowCaution2(false)}
      />
    </div>
  );
}
