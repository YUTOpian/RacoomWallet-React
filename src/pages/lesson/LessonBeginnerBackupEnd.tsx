import { useState } from 'react';
import { Box, Button, Typography } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import AppToolBar from '../../components/AppToolBar';
import MessageDialog from '../../components/MessageDialog';
import PinDialog from '../../components/PinDialog';
import { PinCodeHelper } from '../../lib/storage';
import heroSeclessonLarge from '../../assets/heroimage_seclesson_large.png';

export default function LessonBeginnerBackupEnd() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [showEncryptedAlready, setShowEncryptedAlready] = useState(false);
  const [showPinDialog, setShowPinDialog] = useState(false);
  // Third, automatic "Check PIN" step shown right after PIN registration succeeds - see
  // the same pattern (and the reasoning comment) in LessonLogin.tsx.
  const [showUnlockPinDialog, setShowUnlockPinDialog] = useState(false);

  const onClickedPinSettings = async () => {
    if (await PinCodeHelper.hasSavedCode()) {
      setShowEncryptedAlready(true);
    } else {
      setShowPinDialog(true);
    }
  };

  const goNext = () => navigate('/lesson/beginner_end');

  return (
    <Box sx={{ minHeight: '100vh' }}>
      <AppToolBar back="/lesson/key?lesson=true&mode=mnemonic" title={t('lesson.beginner_backup_end_title')} />
      <Box component="img" src={heroSeclessonLarge} sx={{ width: '100%' }} />
      <Box sx={{ mb: 5, mx: 2 }}>
        <Typography align="center">
          {(t('lesson.beginner_backup_end_message', { returnObjects: true }) as string[]).map((line, i) => (
            <span key={i}>{line}<br /></span>
          ))}
        </Typography>
      </Box>
      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', pb: 4 }}>
        <Button variant="contained" color="primary" size="small" onClick={onClickedPinSettings}>{t('common.pin_settings')}</Button>
      </Box>

      <MessageDialog
        open={showEncryptedAlready}
        title={t('lesson.cancel_pin_title')}
        texts={t('lesson.cancel_pin_message', { returnObjects: true }) as string[]}
        onClose={() => { setShowEncryptedAlready(false); goNext(); }}
      />
      <PinDialog
        open={showPinDialog}
        mode="register"
        onClose={() => setShowPinDialog(false)}
        onPass={() => setShowUnlockPinDialog(true)}
      />
      <PinDialog
        open={showUnlockPinDialog}
        mode="check"
        onClose={() => setShowUnlockPinDialog(false)}
        // A correct PIN here makes PinDialog derive and cache both the Symbol and NEM
        // accounts for the active wallet before moving on.
        onPass={goNext}
        // Getting Symbol/NEM working isn't required to finish the lesson - if the
        // person cancels here, let them through anyway.
        onCancel={goNext}
      />
    </Box>
  );
}
