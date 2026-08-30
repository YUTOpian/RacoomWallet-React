import { useState } from 'react';
import { Box, Button, Typography } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import AppToolBar from '../../components/AppToolBar';
import ErrorSnackbar from '../../components/ErrorSnackbar';
import { useAppStore } from '../../store/appStore';
import { WalletsHelper, PinCodeHelper } from '../../lib/storage';
import { MnemonicHelper } from '../../lib/mnemonic';
import heroSeclessonLarge from '../../assets/heroimage_seclesson_large.png';

export default function LessonBeginner() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const setBackPathFromKey = useAppStore((s) => s.setBackPathFromKey);
  const [errorMessage, setErrorMessage] = useState('');

  // このレッスンは「まだウォレットを1つも持っていない」入り口（For BEGINNERS）から
  // 開かれるため、以前は次のバックアップ画面がアクティブウォレットを見つけられず
  // 「リカバリーフレーズの生成ができない」状態になっていた。ここで実際にウォレットを
  // 1つ生成してアクティブにしてから次の画面に進むことで、そのまま本物のリカバリー
  // フレーズを見せられるようにする。PINコードはまだ無い前提なので、defaultPin で
  // 仮に暗号化しておき、後続の「PINコードの設定」（PinDialog mode="register"）で
  // 実際のPINに一括で再暗号化される（WalletsHelper.encryptWallets 参照）。
  // 既にアクティブなウォレットがある場合（このレッスンをやり直した場合など）は
  // 新規作成せずそのまま使う。
  const goKey = async () => {
    try {
      const existing = await WalletsHelper.getActive();
      if (existing === null) {
        const { phrase, account } = MnemonicHelper.createNew();
        const wallet = await WalletsHelper.createWithMnemonic(
          t('lesson.beginner_wallet_default_name'),
          account.address,
          account.publicKey,
          account.privateKey,
          phrase,
          PinCodeHelper.defaultPin,
        );
        await WalletsHelper.add(wallet, true);
      }
      setBackPathFromKey('/lesson/beginner');
      navigate('/lesson/key/caution?lesson=true&mode=mnemonic');
    } catch (e) {
      console.error('LessonBeginner: failed to prepare a wallet for the backup lesson', e);
      setErrorMessage(t('wallet.creation_failed'));
    }
  };

  return (
    <Box sx={{ minHeight: '100vh' }}>
      <AppToolBar back="/lesson/level" title={t('lesson.beginner_title')} />
      <Box component="img" src={heroSeclessonLarge} sx={{ width: '100%' }} />
      <Box sx={{ mb: 5, mx: 2 }}>
        <Typography align="center">
          {(t('lesson.beginner_message', { returnObjects: true }) as string[]).map((line, i) => (
            <span key={i}>{line}<br /></span>
          ))}
        </Typography>
      </Box>
      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', pb: 4 }}>
        <Button variant="contained" color="primary" size="small" onClick={goKey}>OK</Button>
      </Box>
      <ErrorSnackbar message={errorMessage} onClose={() => setErrorMessage('')} />
    </Box>
  );
}
